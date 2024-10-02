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

const parseData = async (fileData, image, depthBuffer) => {
  let fileDataParsed = {};

  fileData.map((data) => {
    data = data.trim();
    var row = data.split(/\s+/);

    if (row[0] === "depth") {
      fileDataParsed[row[0]] = true;
    }

    if (row[0] === "sRGB") {
      fileDataParsed[row[0]] = true;
    }

    if (row[0] === "hyp") {
      fileDataParsed[row[0]] = true;
    }

    if (row[0] === "position") {
      fileDataParsed[row[0]] = [];
      // scan 4 position coordinates at once and assign to respective variable
      const coords = row.slice(2);
      var i = 0;
      while (i < coords.length) {
        const xyzw = {
          x: coords[i],
          y: coords[i + 1],
          z: coords[i + 2],
          w: coords[i + 3],
        };
        fileDataParsed[row[0]].push(xyzw);
        i += 4;
      }
    }

    if (row[0] === "color") {
      fileDataParsed[row[0]] = [];
      // scan 3 rgb values at once and assign to respective variable
      const colors = row.slice(2);
      var i = 0;
      while (i < colors.length) {
        const rgb = {
          r: parseFloat(colors[i]),
          g: parseFloat(colors[i + 1]),
          b: parseFloat(colors[i + 2]),
        };
        fileDataParsed[row[0]].push(rgb);
        i += 3;
      }
    }

    if (row[0] === "elements") {
      fileDataParsed[row[0]] = [];

      const elements = row.slice(1);
      fileDataParsed[row[0]].push(...elements);
      // console.log(fileDataParsed[row[0]].length);
    }

    var vertices = [];

    if ("position" in fileDataParsed && "color" in fileDataParsed) {
      vertices = fileDataParsed["position"].map((pos, i) => ({
        ...viewportTransform(
          parseFloat(pos.x),
          parseFloat(pos.y),
          parseFloat(pos.w),
          image.width,
          image.height
        ),
        z: parseFloat(pos.z),
        w: parseFloat(pos.w),
        color: fileDataParsed["color"][i],
      }));
    }

    // console.log("vertices", vertices);

    if (row[0] === "drawElementsTriangles") {
      var depth = false;
      var sRGB = false;
      var hyp = false;

      if ("depth" in fileDataParsed) {
        depth = true;
      }
      if ("sRGB" in fileDataParsed) {
        sRGB = true;
      }
      if ("hyp" in fileDataParsed) {
        hyp = true;
      }

      const end = parseInt(row[1]);
      var start = parseInt(row[2]);
      const elements = fileDataParsed["elements"];

      while (start < end) {
        if (
          vertices[elements[start]] &&
          vertices[elements[start + 1]] &&
          vertices[elements[start + 2]]
        ) {
          // console.log("hui");
          const newVert = [
            vertices[elements[start]],
            vertices[elements[start + 1]],
            vertices[elements[start + 2]],
          ];
          draw(image, newVert, depth, depthBuffer, hyp);
        }
        start += 3;
      }
      // for (var i = start; i < end; i++) {
      //   console.log(
      //     vertices[elements[i]],
      //     vertices[elements[i + 1]],
      //     vertices[elements[i + 2]]
      //   );
      //   const newVert = [...vertices];
      //   // console.log(i, elements[i], newVert.length);
      //   if (elements[i] <= newVert.length - 3) {
      //     draw(image, newVert.splice(elements[i], 3), depth, depthBuffer, hyp);
      //   }
      // }
    }

    if (row[0] === "drawArraysTriangles") {
      var depth = false;
      var sRGB = false;
      var hyp = false;

      if ("depth" in fileDataParsed) {
        depth = true;
      }
      if ("sRGB" in fileDataParsed) {
        sRGB = true;
      }
      if ("hyp" in fileDataParsed) {
        hyp = true;
      }

      const count = parseInt(row[2]) / 3;
      // console.log(count);
      if (count > 1) {
        var startIndex = 0;
        for (var i = 0; i < count; i++) {
          // console.log(vertices);
          draw(image, vertices.splice(0, 3), depth, depthBuffer, sRGB, hyp);
          startIndex += 3;
        }
      } else {
        draw(
          image,
          vertices.splice(parseInt(row[1]), parseInt(row[2])),
          depth,
          depthBuffer,
          sRGB,
          hyp
        );
      }
    }
  });
};

const dda = (v1, v2) => {
  let points = [];

  if (v1.y === v2.y) {
    return points; // No points to find if y-coordinates are equal
  }

  if (v1.y > v2.y) {
    [v1, v2] = [v2, v1]; // Swap vertices if v1 is below v2
  }

  let deltaX = v2.x - v1.x;
  let deltaY = v2.y - v1.y;
  let deltaZ = v2.z - v1.z; // Add depth difference
  let deltaColor = {
    r: v2.color.r - v1.color.r,
    g: v2.color.g - v1.color.g,
    b: v2.color.b - v1.color.b,
  };

  let stepX = deltaX / deltaY;
  let stepZ = deltaZ / deltaY; // Step for depth
  let stepColor = {
    r: deltaColor.r / deltaY,
    g: deltaColor.g / deltaY,
    b: deltaColor.b / deltaY,
  };

  let e = Math.ceil(v1.y) - v1.y;
  let offsetX = e * stepX;
  let offsetZ = e * stepZ; // Depth offset
  let offsetColor = {
    r: e * stepColor.r,
    g: e * stepColor.g,
    b: e * stepColor.b,
  };

  let x = v1.x + offsetX;
  let z = v1.z + offsetZ; // Initial depth
  let color = {
    r: v1.color.r + offsetColor.r,
    g: v1.color.g + offsetColor.g,
    b: v1.color.b + offsetColor.b,
  };
  let w = v1.w; // Store original w for normalization later
  let y = Math.ceil(v1.y);

  while (y <= Math.floor(v2.y)) {
    points.push({ x, y, w, z, color: { ...color } });

    x += stepX;
    z += stepZ; // Update depth
    color.r += stepColor.r;
    color.g += stepColor.g;
    color.b += stepColor.b;
    y += 1;
  }

  return points;
};

function interpolateColor(c1, c2, t) {
  if (isNaN(t) || t === Infinity || t === -Infinity) {
    return c1; // If t is NaN or undefined, return the first color
  }

  return {
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t,
  };
}

function interpolateHyperbolicColor(c1, c2, w1, w2, t) {
  // Ensure valid t value
  if (isNaN(t) || t === Infinity || t === -Infinity) {
    return { ...c1 }; // Return the first color if t is invalid
  }

  // Interpolation logic
  const interpolatedColor = {
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t,
  };

  const wInterpolated = (1 - t) * w1 + t * w2; // Interpolated w
  return {
    ...interpolatedColor,
    w: wInterpolated,
  };
}

function scanline(v1, v2, v3, edge1, edge2, edge3, hyp) {
  let points = [];

  for (let y = Math.ceil(v1.y); y <= Math.floor(v3.y); y++) {
    let xLeft, xRight, zLeft, zRight, wLeft, wRight, colorLeft, colorRight;

    if (y <= Math.floor(v2.y)) {
      let leftPoint = edge1.find((point) => point.y === y);
      let rightPoint = edge2.find((point) => point.y === y);

      if (leftPoint && rightPoint) {
        xLeft = leftPoint.x;
        zLeft = leftPoint.z; // Depth at left
        wLeft = leftPoint.w; // W at left
        colorLeft = leftPoint.color;
        xRight = rightPoint.x;
        zRight = rightPoint.z; // Depth at right
        wRight = rightPoint.w; // W at right
        colorRight = rightPoint.color;
      }
    } else {
      let leftPoint = edge3.find((point) => point.y === y);
      let rightPoint = edge2.find((point) => point.y === y);

      if (leftPoint && rightPoint) {
        xLeft = leftPoint.x;
        zLeft = leftPoint.z; // Depth at left
        wLeft = leftPoint.w; // W at left
        colorLeft = leftPoint.color;
        xRight = rightPoint.x;
        zRight = rightPoint.z; // Depth at right
        wRight = rightPoint.w; // W at right
        colorRight = rightPoint.color;
      }
    }

    if (xLeft !== undefined && xRight !== undefined && xLeft > xRight) {
      [xLeft, xRight] = [xRight, xLeft];
      [zLeft, zRight] = [zRight, zLeft]; // Swap depths
      [wLeft, wRight] = [wRight, wLeft]; // Swap w
      [colorLeft, colorRight] = [colorRight, colorLeft];
    }

    if (
      xLeft !== undefined &&
      xRight !== undefined &&
      colorLeft &&
      colorRight
    ) {
      for (let x = Math.ceil(xLeft); x <= Math.floor(xRight); x++) {
        let t = xRight !== xLeft ? (x - xLeft) / (xRight - xLeft) : 0;

        let z = zLeft + (zRight - zLeft) * t; // Interpolate depth
        let w = wLeft + (wRight - wLeft) * t; // Interpolate w
        let color;

        if (hyp) {
          color = interpolateHyperbolicColor(
            colorLeft,
            colorRight,
            wLeft,
            wRight,
            t
          );
          points.push({ x, y, z, w: color.w, color });

          // color.r /= w; // Undo division by w for color
          // color.g /= w; // Undo division by w for color
          // color.b /= w; // Undo division by w for color
        } else {
          color = interpolateColor(colorLeft, colorRight, t);
          points.push({ x, y, z, color });
        }
      }
    }
  }

  return points;
}

function linearToSrgb(value) {
  if (value <= 0.0031308) {
    return 12.92 * value;
  } else {
    return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  }
}

function displayPixels(img, points, sRGB) {
  for (const point of points) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);

    // Ensure the point is within image bounds
    if (x >= 0 && x < img.width && y >= 0 && y < img.height) {
      for (const point of points) {
        if (sRGB) {
          const color = rgbaToInt(
            Math.round(linearToSrgb(point.color.r) * 255),
            Math.round(linearToSrgb(point.color.g) * 255),
            Math.round(linearToSrgb(point.color.b) * 255),
            255 // Alpha
          );
          img.setPixelColor(color, Math.round(point.x), point.y);
        } else {
          const color = rgbaToInt(
            Math.round(point.color.r * 255),
            Math.round(point.color.g * 255),
            Math.round(point.color.b * 255),
            255 // Alpha
          );
          img.setPixelColor(color, Math.round(point.x), point.y);
        }
      }
    }
  }
}

function displayPixelsWithDepth(img, points, depthBuffer, sRGB) {
  for (const point of points) {
    // point.z *= 1 / point.w;
    const x = Math.round(point.x);
    const y = Math.round(point.y);

    // Ensure the point is within image bounds
    if (x >= 0 && x < img.width && y >= 0 && y < img.height) {
      // Check the depth buffer

      if (point.z < depthBuffer[y][x]) {
        // console.log(point.w);
        // point.color.r /= point.w;
        // point.color.g /= point.w;
        // point.color.b /= point.w;
        if (sRGB) {
          const color = rgbaToInt(
            Math.round(linearToSrgb(point.color.r) * 255),
            Math.round(linearToSrgb(point.color.g) * 255),
            Math.round(linearToSrgb(point.color.b) * 255),
            255 // Alpha
          );
          img.setPixelColor(color, x, y);
        } else {
          const color = rgbaToInt(
            Math.round(point.color.r * 255),
            Math.round(point.color.g * 255),
            Math.round(point.color.b * 255),
            255 // Alpha
          );
          img.setPixelColor(color, x, y);
        }
        // Update the depth buffer with the new depth
        depthBuffer[y][x] = point.z;
        // }
      }
    }
  }
}

function draw(img, vertices, depth, depthBuffer, sRGB, hyp) {
  vertices.sort((a, b) => a.y - b.y); // Sort by y-coordinate

  let [top, mid, bottom] = vertices;
  // console.log("1", top);
  if (hyp) {
    top.z = top.z * (1 / top.w);
    top.color = {
      r: top.color.r / top.w,
      g: top.color.g / top.w,
      b: top.color.b / top.w,
    };
    mid.z = mid.z * (1 / mid.w);
    mid.color = {
      r: mid.color.r / mid.w,
      g: mid.color.g / mid.w,
      b: mid.color.b / mid.w,
    };
    bottom.z = bottom.z * (1 / bottom.w);
    bottom.color = {
      r: bottom.color.r / bottom.w,
      g: bottom.color.g / bottom.w,
      b: bottom.color.b / bottom.w,
    };
  }
  // console.log("2", top);
  const edge1 = dda(top, mid);
  const edge2 = dda(top, bottom);
  const edge3 = dda(mid, bottom);

  var points = scanline(top, mid, bottom, edge1, edge2, edge3, hyp);

  if (depth) {
    displayPixelsWithDepth(img, points, depthBuffer, sRGB);
  } else {
    displayPixels(img, points, sRGB);
  }
}

const main = async () => {
  const filePath = process.argv[2];

  if (filePath) {
    try {
      const fileData = await readFileFromPath(filePath);

      // create image
      const data = fileData.split("\n");
      const row1 = data[0].split(/\s+/);

      const image = new Jimp({
        width: parseInt(row1[1]),
        height: parseInt(row1[2]),
      });

      let depthBuffer = Array.from({ length: image.height }, () =>
        Array(image.width).fill(Infinity)
      ); // Initialize with Infinity

      await parseData(data.slice(1), image, depthBuffer);

      await image.write(row1[3]);
    } catch (error) {
      console.error("Failed to read file:", error.message);
    }
  } else {
    console.error("Please provide a file path as an argument.");
  }
};

main();
