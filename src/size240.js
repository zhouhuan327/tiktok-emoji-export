import fs from "fs";

import path from "path";
import sharp from "sharp";

// 目标文件夹路径
const targetFolder = "/Users/zhouhuan/Pictures/表情汇总/烦薯"; // 替换为你的目标文件夹路径

// 最小分辨率
const minResolution = 500;
async function createIfAbsent(targetFolder) {
  const formatPath = path.join(targetFolder, 'format');
  try {
      await fs.accessSync(formatPath);
      console.log('format 文件夹已存在');
  } catch {
      await fs.mkdirSync(formatPath);
      console.log('format 文件夹创建成功');
  }
}

createIfAbsent(targetFolder)

// 递归遍历文件夹
async function processFolder(folderPath) {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // 如果是文件夹，递归处理
      await processFolder(filePath);
    } else if (stat.isFile() && path.extname(file).toLowerCase() === ".png") {
      // 如果是 PNG 文件，处理图片
      await processImage(filePath, path.extname(file));
    }
  }
}

// 处理图片
async function processImage(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    // 调整分辨率
    await image
      .withMetadata({
        density: 240, // 设置 DPI
      })
      .resize({
        width: minResolution,
        height: minResolution,
        fit: "inside", // 保持比例，不超过 240x240
        withoutEnlargement: false, // 允许放大
      })
      .toFile(path.join(targetFolder, "format", path.basename(imagePath))); // 覆盖原文件
  } catch (error) {
    console.error(`Error processing ${imagePath}:`, error);
  }
}

// 启动处理
processFolder(targetFolder)
  .then(() => {
    console.log("All images processed.");
  })
  .catch((err) => {
    console.error("Error processing folder:", err);
  });
