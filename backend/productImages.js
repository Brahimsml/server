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

/*
  Is this a product cut-out (white or see-through background) or a full photo
  (a desk, a room, a coloured backdrop)? Looks at a thin frame around the edges:
  mostly near-white means a cut-out.
*/
async function hasLightBackground(buffer) {
  const N = 48;
  const { data } = await sharp(buffer).resize(N, N, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let light = 0;
  let total = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (x > 1 && x < N - 2 && y > 1 && y < N - 2) continue; // edges only
      const i = (y * N + x) * 3;
      total += 1;
      if (data[i] > 222 && data[i + 1] > 222 && data[i + 2] > 222) light += 1;
    }
  }
  return light / total > 0.6;
}

// After a white frame is trimmed away: a cut-out still has white corners (the product
// rarely reaches them), a photo has coloured corners
async function hasLightCorners(buffer) {
  const N = 48;
  const P = 4; // corner patch size
  const { data } = await sharp(buffer).resize(N, N, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [
    [0, 0],
    [N - P, 0],
    [0, N - P],
    [N - P, N - P],
  ];
  let lightCorners = 0;
  for (const [cx, cy] of corners) {
    let sum = 0;
    for (let y = cy; y < cy + P; y++) for (let x = cx; x < cx + P; x++) {
      const i = (y * N + x) * 3;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    if (sum / (P * P) > 222) lightCorners += 1;
  }
  return lightCorners >= 2;
}

// Full photos fill the whole 4:3 frame (cropped to fit, no white bars)
async function fillPhoto(buffer, encode) {
  return encode(sharp(buffer).resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })).toBuffer();
}

/*
  options.photos: also handle full photos (uploads). Returns "product" or "photo"
  (false when the format isn't supported). Without it every image is treated as a
  cut-out, which is what the batch script for existing files expects.
*/
async function standardizeProductImage(filePath, options = {}) {
  const encode = encoders[path.extname(filePath).toLowerCase()];
  if (!encode) return false;

  // Turn photos taken sideways upright, and put see-through PNGs on white
  const flat = await sharp(filePath).rotate().flatten({ background: WHITE }).toBuffer();

  if (options.photos) {
    // A photo: coloured edges, or a white frame around a photo (corners still coloured once trimmed)
    let photo = null;
    if (!(await hasLightBackground(flat))) photo = flat;
    else {
      try {
        const inner = await sharp(flat).trim({ threshold: 20 }).toBuffer();
        if (!(await hasLightCorners(inner))) photo = inner;
      } catch {
        // one plain colour: treat as a cut-out
      }
    }
    if (photo) {
      const temp = `${filePath}.tmp`;
      await fs.promises.writeFile(temp, await fillPhoto(photo, encode));
      await fs.promises.rename(temp, filePath);
      return "photo";
    }
  }

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
  return "product";
}

// Full photos get "__full" in their file name, so the site shows them edge to edge
// (cut-outs sit on the white "studio" box with a margin instead)
async function markFullPhoto(file) {
  const { dir, name, ext } = path.parse(file.path);
  if (name.endsWith("__full")) return;
  const renamed = path.join(dir, `${name}__full${ext}`);
  await fs.promises.rename(file.path, renamed);
  file.path = renamed;
  file.filename = path.basename(renamed);
}

async function processUploadedPhoto(file) {
  if ((await standardizeProductImage(file.path, { photos: true })) === "photo") await markFullPhoto(file);
}

// Express middleware for product uploads: runs after multer saved the file
const processProductUpload = async (req, res, next) => {
  if (!req.file) return next();
  try {
    await processUploadedPhoto(req.file);
    next();
  } catch (err) {
    console.error("❌ Could not process product image:", err.message);
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ message: "That image couldn't be read. Please try another file." });
  }
};

// Same, for the product form: the main photo ("image") plus extra photos ("gallery").
// Afterwards req.file is the main photo, like with a single upload.
const processProductUploads = async (req, res, next) => {
  const files = [...(req.files?.image || []), ...(req.files?.gallery || [])];
  req.file = req.files?.image?.[0];
  try {
    for (const file of files) await processUploadedPhoto(file);
    next();
  } catch (err) {
    console.error("❌ Could not process product image:", err.message);
    files.forEach((file) => fs.unlink(file.path, () => {}));
    res.status(400).json({ message: "One of the images couldn't be read. Please try another file." });
  }
};

/*
  Home page banners: every banner becomes 1600 x 600 (cropped to fill, keeping the most
  eye-catching part, e.g. the product), on the
  site's dark colour if the image has see-through parts. Same file name and format.
*/
const BANNER_WIDTH = 1600;
const BANNER_HEIGHT = 600;
const DARK = { r: 11, g: 9, b: 7, alpha: 1 };

async function standardizeBannerImage(filePath) {
  const encode = encoders[path.extname(filePath).toLowerCase()];
  if (!encode) return false;
  const out = await encode(
    sharp(filePath).rotate().flatten({ background: DARK }).resize(BANNER_WIDTH, BANNER_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
  ).toBuffer();
  await fs.promises.writeFile(filePath, out);
  return true;
}

// Middleware for the banner form (one optional "image")
const processBannerUpload = async (req, res, next) => {
  if (!req.file) return next();
  try {
    await standardizeBannerImage(req.file.path);
    next();
  } catch (err) {
    console.error("❌ Could not process banner image:", err.message);
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ message: "That image couldn't be read. Please try another file." });
  }
};

module.exports = { standardizeProductImage, processProductUpload, processProductUploads, processBannerUpload };
