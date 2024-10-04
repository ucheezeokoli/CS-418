function compileShader(vs_source, fs_source) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vs_source);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(vs));
    throw Error("Vertex shader compilation failed");
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fs_source);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(fs));
    throw Error("Fragment shader compilation failed");
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    throw Error("Linking failed");
  }
  return program;
}

function setupGeomery(geom) {
  var triangleArray = gl.createVertexArray();
  gl.bindVertexArray(triangleArray);

  for (let i = 0; i < geom.attributes.length; i += 1) {
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    let f32 = new Float32Array(geom.attributes[i].flat());
    gl.bufferData(gl.ARRAY_BUFFER, f32, gl.STATIC_DRAW);

    gl.vertexAttribPointer(
      i,
      geom.attributes[i][0].length,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(i);
  }

  var indices = new Uint16Array(geom.triangles.flat());
  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return {
    mode: gl.TRIANGLES,
    count: indices.length,
    type: gl.UNSIGNED_SHORT,
    vao: triangleArray,
  };
}

function getRotationMatrix(angle) {
  let c = Math.cos(angle);
  let s = Math.sin(angle);

  // 4x4 matrix for rotation around Z-axis
  return new Float32Array([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// Function to get a translation matrix
function getTranslationMatrix(tx, ty) {
  return new Float32Array([
    1,
    0,
    0,
    0, // No scaling on X
    0,
    1,
    0,
    0, // No scaling on Y
    0,
    0,
    1,
    0, // No scaling on Z (we are working in 2D)
    tx,
    ty,
    0,
    1, // Translation by tx and ty
  ]);
}

// Function to multiply two 4x4 matrices (translation * rotation)
function multiplyMatrices(a, b) {
  let out = new Float32Array(16);
  for (let i = 0; i < 4; ++i) {
    for (let j = 0; j < 4; ++j) {
      out[j * 4 + i] = 0;
      for (let k = 0; k < 4; ++k) {
        out[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
      }
    }
  }
  return out;
}

function draw(milliseconds) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Calculate the rotation angle in radians based on time (rotates every 5 seconds)
  let angle = ((milliseconds / 1000) % 5) * ((Math.PI * 2) / 5); // Complete rotation every 5 seconds

  // Set the translation values to make the object move around the canvas
  let amplitude = 0.5; // The larger this value, the farther it moves
  let speed = 1.0; // Controls how fast the object moves

  // Calculate the translation based on time for horizontal and vertical movement
  let tx = amplitude * Math.cos((milliseconds / 1000) * speed); // Horizontal movement
  let ty = amplitude * Math.sin((milliseconds / 1000) * speed); // Vertical movement

  // Get the rotation matrix for the object
  let rotationMatrix = getRotationMatrix(angle);

  // Get the translation matrix to move the object around the canvas
  let translationMatrix = getTranslationMatrix(tx, ty);

  // Combine the translation and rotation matrices
  let modelMatrix = multiplyMatrices(translationMatrix, rotationMatrix);

  // Pass the rotation matrix to the shader uniform
  let uModelMatrixLocation = gl.getUniformLocation(program, "uModelMatrix");
  gl.useProgram(program);
  gl.uniformMatrix4fv(uModelMatrixLocation, false, modelMatrix);

  gl.bindVertexArray(geom.vao);
  gl.drawElements(geom.mode, geom.count, geom.type, 0);
}

function tick(milliseconds) {
  draw(milliseconds);
  requestAnimationFrame(tick); // asks browser to call tick before next frame
}

window.addEventListener("load", async (event) => {
  // We get the HTML <canvas> element by its ID and use it as the drawing surface
  // initialize a WebGL2 rendering context, which provides the WebGL2 API to render graphics
  window.gl = document.querySelector("canvas").getContext("webgl2");
  let vs = await fetch("vertex.glsl").then((res) => res.text());
  let fs = await fetch("fragment.glsl").then((res) => res.text());
  window.program = compileShader(vs, fs);
  let data = await fetch("geometry.json").then((r) => r.json());
  window.geom = setupGeomery(data);
  requestAnimationFrame(tick); // asks browser to call tick before first frame
});
