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

const parseData = async (fileData, image) => {
  let fileDataParsed = {};
  fileData.map((data) => {
    data = data.trim();
    var row = data.split(/\s+/);
    fileDataParsed[row[0]] = row.slice(1);

    if (row[0] === "drawPixels") {
      run(
        fileDataParsed.position,
        fileDataParsed.color,
        fileDataParsed.drawPixels,
        image
      ).catch(console.error);
    }
  });
};

const run = async (positions, colors, pixelLength, image) => {
  var pos_idx = 1;
  var colors_idx = 1;
  var i = 0;
  while (i < pixelLength) {
    const x = parseInt(positions[pos_idx]);
    const y = parseInt(positions[pos_idx + 1]);
    const r = parseInt(colors[colors_idx]);
    const g = parseInt(colors[colors_idx + 1]);
    const b = parseInt(colors[colors_idx + 2]);
    const a = parseInt(colors[colors_idx + 3]);

    const rgba = rgbaToInt(r, g, b, a);

    image.setPixelColor(rgba, x, y);

    i++;
    pos_idx += 2;
    colors_idx += 4;
  }
};

const main = async () => {
  const filePath = process.argv[2];

  if (filePath) {
    try {
      const fileData = await readFileFromPath(filePath);

      // create image
      const data = fileData.split("\n");
      const row1 = data[0].split(/\s+/);

      //   const background = rgbaToInt(255, 255, 0, 50);
      const image = new Jimp({
        width: parseInt(row1[1]),
        height: parseInt(row1[2]),
      });

      await parseData(data.slice(1), image);

      await image.write(row1[3]);
    } catch (error) {
      console.error("Failed to read file:", error.message);
    }
  } else {
    console.error("Please provide a file path as an argument.");
  }
};

main();
