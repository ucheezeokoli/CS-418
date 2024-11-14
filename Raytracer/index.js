import * as fs from "fs/promises";
import * as path from "path";
import { Jimp, rgbaToInt } from "jimp";

const readFileFromPath = async (filePath) => {
  try {
    // Resolve the file path
    const resolvedPath = path.resolve(filePath);

    // Read the file using fs.promises.readFile
    const fileData = await fs.readFile(resolvedPath, "utf8");

    return fileData;
  } catch (err) {
    console.error("Error reading file:", err.message);
    process.exit(1);
  }
};

// Function to convert from normalized device coordinates to screen space
function viewportTransform(x, y, w, width, height) {
  const newX = ((x / w + 1) * width) / 2;
  const newY = ((y / w + 1) * height) / 2;
  return { x: newX, y: newY };
}

// Helper function for convert RGB to sRGB
function linearToSrgb(value) {
  if (value <= 0.0031308) {
    return 12.92 * value;
  } else {
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  }
}

// Helper function to calculate dot product
function dot(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

// Helper function to subtract vectors
function subtract(v1, v2) {
  return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
}

// Helper function to normalize a vector
function normalize(v) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

// Ray-sphere intersection function
function intersectSphere(rayOrigin, rayDir, sphere) {
  const center = sphere.center;
  const radius = sphere.radius;

  // (bx^2 + by^2)t^2 + (2(axbx + ayby))t + (ax^2 + ay^2 r^2) = 0
  // a = ray origin
  // b = ray direction
  // r = radius
  // t = hit distance

  const oc = subtract(rayOrigin, center);
  const a = dot(rayDir, rayDir);
  const b = 2 * dot(oc, rayDir);
  const c = dot(oc, oc) - radius * radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null; // No intersection

  // Quadratic equation
  const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
  if (t > 0) {
    return t; // Return the distance to the intersection
  }
  return null;
}

// Function to calculate ray-plane intersection
function intersectPlane(rayOrigin, rayDir, plane) {
  const { A, B, C, D } = plane;
  const normal = { x: A, y: B, z: C };
  const denom = dot(normal, rayDir);

  // Check if the ray is parallel to the plane (denom ≈ 0)
  if (Math.abs(denom) < 1e-6) return null;

  // Calculate t for the ray-plane intersection
  const t = -(dot(normal, rayOrigin) + D) / denom;

  // Return the intersection distance if it's positive (in front of the ray origin)
  return t > 0 ? t : null;
}

function intersectTriangle(rayOrigin, rayDir, triangle) {
  const { v1, v2, v3 } = triangle;
  if (v1 == undefined) return null;
  console.log(v1, v2, v3);
  const edge1 = subtract(v2.position, v1.position);
  const edge2 = subtract(v3.position, v1.position);
  const h = crossProduct(rayDir, edge2);
  const a = dot(edge1, h);

  if (Math.abs(a) < 1e-6) return null; // Ray is parallel to the triangle

  const f = 1.0 / a;
  const s = subtract(rayOrigin, v1.position);
  const u = f * dot(s, h);

  if (u < 0.0 || u > 1.0) return null;

  const q = crossProduct(s, edge1);

  const v = f * dot(rayDir, q);

  if (v < 0.0 || u + v > 1.0) return null;

  const t = f * dot(edge2, q);
  return t > 0 ? t : null;
}

// Helper function for generating a secondary ray to check for shadows
function isInShadow(point, lightDir, sceneObjects, bias = 0.001) {
  // Offset the point slightly along the normal to prevent self-intersection
  const shadowRayOrigin = {
    x: point.x + lightDir.x * bias,
    y: point.y + lightDir.y * bias,
    z: point.z + lightDir.z * bias,
  };

  // Check if this shadow ray hits any objects before reaching the light
  for (const obj of sceneObjects) {
    if (obj.type === "sphere") {
      const t = intersectSphere(shadowRayOrigin, lightDir, obj);
      if (t !== null && t > 0) {
        return true; // There's something blocking the light, so it's in shadow
      }
    }
  }
  return false; // No objects were hit, so it's not in shadow
}

// Exposure function
function applyExposure(color, exposure) {
  // console.log(exposure == undefined);
  if (exposure !== undefined) {
    return {
      r: 1 - Math.exp(-exposure * color.r),
      g: 1 - Math.exp(-exposure * color.g),
      b: 1 - Math.exp(-exposure * color.b),
    };
  }
  // console.log("hi");
  return color; // If no exposure, just return the original color
}

// Helper function to calculate the cross product of two vectors
function crossProduct(v1, v2) {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
}

// Resolve 1-based or negative indices
function resolveIndex(i, length) {
  return i < 0 ? length + i : i - 1;
}

// Main rendering function
async function renderScene(scene) {
  console.log(scene);
  const { width, height, filename } = scene.image;
  const image = new Jimp({ width, height });
  let rayOrigin = { x: 0, y: 0, z: 0 };
  let f = { x: 0, y: 0, z: -1 };
  let r = { x: 1, y: 0, z: 0 };
  let u = { x: 0, y: 1, z: 0 };
  if (
    Object.keys(scene.eye).length === 3 &&
    Object.keys(scene.forward).length === 3 &&
    Object.keys(scene.up).length === 3
  ) {
    rayOrigin = scene.eye;
    f = scene.forward;
    u = normalize(crossProduct(r, f));
    r = normalize(crossProduct(f, u));
  }

  let sunDirection = { x: 0, y: 0, z: 0 };
  let sunColor = { r: 1, g: 1, b: 1 }; // Default sunlight color

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sx = (2 * x - width) / Math.max(width, height);
      let sy = (height - 2 * y) / Math.max(width, height);

      let rayDir = normalize({
        x: f.x + sx * r.x + sy * u.x,
        y: f.y + sx * r.y + sy * u.y,
        z: f.z + sx * r.z + sy * u.z,
      });

      const sx2_sy2 = sx * sx + sy * sy;
      if (scene.fisheye) {
        if (sx2_sy2 <= 1) {
          const fisheyeFactor = Math.sqrt(1 - sx2_sy2);
          rayDir = normalize({
            x: f.x * fisheyeFactor + sx * r.x + sy * u.x,
            y: f.y * fisheyeFactor + sx * r.y + sy * u.y,
            z: f.z * fisheyeFactor + sx * r.z + sy * u.z,
          });
        } else {
          rayDir = { x: 0, y: 0, z: 0 };
        }
      }

      if (scene.panorama) {
        // Normalize the pixel coordinates to represent latitude and longitude
        let lon = (2 * Math.PI * x) / width - Math.PI; // Longitude, scaled to [-π, π]
        let lat = (Math.PI * (height - y)) / height - Math.PI / 2; // Latitude, scaled to [-π/2, π/2]

        // Calculate ray direction in spherical coordinates
        rayDir = {
          x:
            Math.cos(lat) * Math.sin(lon) * r.x +
            Math.sin(lat) * u.x +
            Math.cos(lat) * Math.cos(lon) * f.x,
          y:
            Math.cos(lat) * Math.sin(lon) * r.y +
            Math.sin(lat) * u.y +
            Math.cos(lat) * Math.cos(lon) * f.y,
          z:
            Math.cos(lat) * Math.sin(lon) * r.z +
            Math.sin(lat) * u.z +
            Math.cos(lat) * Math.cos(lon) * f.z,
        };
      }

      let closestT = Infinity;

      // Check intersection with each sphere
      for (const obj of scene.objects) {
        let t = null;

        if (obj.type === "sphere") {
          t = intersectSphere(rayOrigin, rayDir, obj);
        } else if (obj.type === "plane") {
          t = intersectPlane(rayOrigin, rayDir, obj);
        } else if (obj.type === "tri") {
          t = intersectTriangle(rayOrigin, rayDir, obj);
        } else if (obj.type === "sun") {
          sunDirection = normalize(obj.lightDirection);
          sunColor = obj.color;
        }

        if (t !== null && t < closestT) {
          closestT = t;
          const intersectionPoint = {
            x: rayOrigin.x + t * rayDir.x,
            y: rayOrigin.y + t * rayDir.y,
            z: rayOrigin.z + t * rayDir.z,
          };

          // Calculate normal at the intersection point
          let normal;
          if (obj.type === "sphere") {
            normal = normalize(subtract(intersectionPoint, obj.center));
          } else if (obj.type === "plane") {
            normal = normalize({ x: obj.A, y: obj.B, z: obj.C });
          } else if (obj.type === "tri") {
            const edge1 = subtract(obj.v2.position, obj.v1.position);
            const edge2 = subtract(obj.v3.position, obj.v1.position);
            normal = normalize(crossProduct(edge1, edge2));
          }

          // Shadow check: determine if point is in shadow relative to the sun
          const inShadow = isInShadow(
            intersectionPoint,
            sunDirection,
            scene.objects
          );

          // Diffuse lighting
          let diffuseIntensity = Math.max(dot(normal, sunDirection), 0.0);
          if (inShadow) diffuseIntensity *= 0; // Reduce intensity if in shadow (shadow factor)

          const r = obj.color.r * sunColor.r * diffuseIntensity;
          const g = obj.color.g * sunColor.g * diffuseIntensity;
          const b = obj.color.b * sunColor.b * diffuseIntensity;

          const colorWithExposure = applyExposure({ r, g, b }, scene.exposure);

          let hitColor = rgbaToInt(
            Math.floor(linearToSrgb(colorWithExposure.r) * 255),
            Math.floor(linearToSrgb(colorWithExposure.g) * 255),
            Math.floor(linearToSrgb(colorWithExposure.b) * 255),
            255
          );
          // console.log(
          //   "pixels =>",
          //   { x: x, y: y },
          //   "sRGB color =>",
          //   {
          //     r: Math.floor(linearToSrgb(r) * 255),
          //     g: Math.floor(linearToSrgb(g) * 255),
          //     b: Math.floor(linearToSrgb(b) * 255),
          //   },
          //   "sun Direction =>",
          //   sunDirection,
          //   "intersection point =>",
          //   intersectionPoint
          // );
          image.setPixelColor(hitColor, x, y);
        }
      }
    }
  }

  await image.write(filename);
  console.log(`Image saved as ${filename}`);
}

function parseInput(input) {
  const lines = input.trim().split("\n");
  const scene = {
    image: {},
    objects: [],
    vertices: [],
    up: {},
    eye: {},
    forward: {},
    fisheye: false,
    panorama: false,
  };
  let currentColor = { r: 1, g: 1, b: 1 }; // Default color (white)

  lines.forEach((line) => {
    const parts = line.trim().split(/\s+/);
    const keyword = parts[0].toLowerCase();

    if (keyword === "png") {
      scene.image = {
        width: parseInt(parts[1]),
        height: parseInt(parts[2]),
        filename: parts[3],
      };
    } else if (keyword === "sphere") {
      const sphere = {
        type: keyword,
        center: {
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        },
        radius: parseFloat(parts[4]),
        color: { ...currentColor },
      };
      scene.objects.push(sphere);
    } else if (keyword === "plane") {
      const plane = {
        type: keyword,
        A: parts[1],
        B: parts[2],
        C: parts[3],
        D: parts[4],
        color: { ...currentColor },
      };
      scene.objects.push(plane);
    } else if (keyword === "sun") {
      const sun = {
        type: keyword,
        lightDirection: {
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        },
        color: { ...currentColor },
      };
      scene.objects.push(sun);
    } else if (keyword === "xyz") {
      const xyz = {
        position: {
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          z: parseFloat(parts[3]),
        },
      };
      scene.vertices.push(xyz);
    } else if (keyword === "tri") {
      const vertexCount = scene.vertices.length;
      const i1 = parts[1];
      const i2 = parts[2];
      const i3 = parts[3];

      // Adjust for 1-based or negative indices
      const idx1 = i1 > 0 ? i1 - 1 : vertexCount + i1;
      const idx2 = i2 > 0 ? i2 - 1 : vertexCount + i2;
      const idx3 = i3 > 0 ? i3 - 1 : vertexCount + i3;

      if (
        idx1 >= 0 &&
        idx1 < vertexCount &&
        idx2 >= 0 &&
        idx2 < vertexCount &&
        idx3 >= 0 &&
        idx3 < vertexCount
      ) {
        // return [vertices[idx1], vertices[idx2], vertices[idx3]];
        const tri = {
          type: keyword,
          v1: scene.vertices[idx1],
          v2: scene.vertices[idx2],
          v3: scene.vertices[idx3],
          color: { ...currentColor },
        };
        scene.objects.push(tri);
      }

      // const tri = {
      //   type: keyword,
      //   v1: scene.vertices[resolveIndex(parts[1], scene.vertices.length)],
      //   v2: scene.vertices[resolveIndex(parts[2], scene.vertices.length)],
      //   v3: scene.vertices[resolveIndex(parts[3], scene.vertices.length)],
      //   color: { ...currentColor },
      // };
      // scene.objects.push(tri);
    } else if (keyword === "color") {
      currentColor = {
        r: parseFloat(parts[1]),
        g: parseFloat(parts[2]),
        b: parseFloat(parts[3]),
      };
    } else if (keyword === "expose") {
      scene.exposure = parseFloat(parts[1]);
    } else if (keyword === "up") {
      scene.up = {
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        z: parseFloat(parts[3]),
      };
    } else if (keyword === "eye") {
      scene.eye = {
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        z: parseFloat(parts[3]),
      };
    } else if (keyword === "forward") {
      scene.forward = {
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        z: parseFloat(parts[3]),
      };
    } else if (keyword === "fisheye") {
      scene.fisheye = true;
    } else if (keyword === "panorama") {
      scene.panorama = true;
    }
  });
  renderScene(scene);
}

const main = async () => {
  const filePath = process.argv[2];

  if (filePath) {
    try {
      const fileData = await readFileFromPath(filePath);

      console.log("Input Data", fileData);

      parseInput(fileData);
    } catch (error) {
      console.error("Failed to read file:", error.message);
    }
  } else {
    console.error("Please provide a file path as an argument.");
  }
};

main();
