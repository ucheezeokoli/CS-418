// Object.defineProperty(exports, "__esModule", { value: true });
import * as fs from "fs/promises";
import * as path from "path";
// var fs = require("fs/promises");
// var path = require("path");
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

const parseData = async (fileData) => {
  const fileDataRows = fileData.split("\n");

  let fileDataParsed = {};
  fileDataRows.map((data) => {
    data = data.trim();
    var row = data.split(/\s+/);
    fileDataParsed[row[0]] = row.slice(1);
  });

  return fileDataParsed;
};

const run = async (width, height, positions, colors, pixelLength, fileName) => {
  const image = new Jimp({ width: parseInt(width), height: parseInt(height) });

  var pos_idx = 0;
  var colors_idx = 1;
  var i = 0;
  while (i < pixelLength) {
    const x = parseInt(positions[pos_idx]);
    const y = parseInt(positions[pos_idx + 1]);
    const r = parseInt(colors[colors_idx]);
    const g = parseInt(colors[colors_idx + 1]);
    const b = parseInt(colors[colors_idx + 2]);
    const a = parseInt(colors[colors_idx + 3]);
    // console.log(r, g, b, a);
    const rgba = rgbaToInt(r, g, b, a);

    image.setPixelColor(rgba, x, y);

    i++;
    pos_idx += 2;
    colors_idx += 4;
  }

  await image.write(fileName);
};

const main = async () => {
  const filePath = process.argv[2];

  if (filePath) {
    try {
      const fileData = await readFileFromPath(filePath);

      const data = await parseData(fileData);
      console.log(data);

      run(
        data.png[0],
        data.png[1],
        data.position,
        data.color,
        data.drawPixels,
        data.png[2]
      ).catch(console.error);
    } catch (error) {
      console.error("Failed to read file:", error.message);
    }
  } else {
    console.error("Please provide a file path as an argument.");
  }
};

main();
