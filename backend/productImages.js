/*
  Product photos all get the same look, like on big shops:
  - the empty border around the product is cut away
  - the product is centred on a white 4:3 canvas (the shape of the product cards)
    with the same margin every time
  - every photo is 1000 x 750 and compressed

  The file keeps its name and format (jpg stays jpg, png stays png...),
  so nothing in the database has to change.
*/
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const WIDTH = 1000; // final size in pixels (4:3, like the product cards)
const HEIGHT = 750;
const MARGIN = 30; // white space kept around the product (the cards add their own padding)
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const encoders = {
  ".jpg": (img) => img.jpeg({ quality: 86, mozjpeg: true }),
  ".jpeg": (img) => img.jpeg({ quality: 86, mozjpeg: true }),
  ".png": (img) => img.png({ compressionLevel: 9 }),
  ".webp": (img) => img.webp({ quality: 86 }),
  ".gif": (img) => img.gif(),
};

async function standardizeProductImage(filePath) {
  const encode = encoders[path.extname(filePath).toLowerCase()];
  if (!encode) return false;

  // Turn photos taken sideways upright, and put see-through PNGs on white
  const flat = await sharp(filePath).rotate().flatten({ background: WHITE }).toBuffer();

  // Cut the plain border (colour taken from the corner). A picture that is
  // one plain colour can't be trimmed, so it's used as it is.
  let trimmed = flat;
  try {
    trimmed = await sharp(flat).trim({ threshold: 20 }).toBuffer();
  } catch {
    trimmed = flat;
  }

  const output = await encode(
    sharp(trimmed)
      .resize(WIDTH - MARGIN * 2, HEIGHT - MARGIN * 2, { fit: "contain", background: WHITE })
      .extend({ top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, background: WHITE })
  ).toBuffer();

  // Write next to the original first, then swap, so a crash never leaves half a file
  const temp = `${filePath}.tmp`;
  await fs.promises.writeFile(temp, output);
  await fs.promises.rename(temp, filePath);
  return true;
}

// Express middleware for product uploads: runs after multer saved the file
const processProductUpload = async (req, res, next) => {
  if (!req.file) return next();
  try {
    await standardizeProductImage(req.file.path);
    next();
  } catch (err) {
    console.error("❌ Could not process product image:", err.message);
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ message: "That image couldn't be read. Please try another file." });
  }
};

module.exports = { standardizeProductImage, processProductUpload };
