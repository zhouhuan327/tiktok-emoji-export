import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

// 获取当前模块的目录路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 处理图片：裁剪宽高各 2 像素，并保存到 after 文件夹
 * @param {string} inputPath - 输入图片路径
 * @param {string} outputPath - 输出图片路径
 */
async function processImage(inputPath, outputPath) {
  try {
    // 获取图片的元数据，包括宽度和高度
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width - 2;
    const height = metadata.height - 2;

    // 使用 sharp 读取图片并进行裁剪
    await sharp(inputPath, { animated: true })
      .extract({ left: 1, top: 1, width, height }) // 裁剪图片
      .toFile(outputPath);
    console.log(`图片处理完成: ${outputPath}`);
  } catch (error) {
    console.error(`处理图片失败: ${inputPath}`, error);
  }
}

/**
 * 遍历文件夹，处理所有图片
 * @param {string} folderPath - 文件夹路径
 */
async function processFolder(folderPath) {
  try {
    // 创建 after 文件夹
    const outputFolder = path.join(folderPath, "after");
    await fs.mkdir(outputFolder, { recursive: true });

    // 读取文件夹内容
    const files = await fs.readdir(folderPath);

    // 过滤并处理图片文件
    const imageFiles = files.filter((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file)
    );
    await Promise.all(
      imageFiles.map(async (file) => {
        const inputPath = path.join(folderPath, file);
        const outputPath = path.join(outputFolder, file);
        await processImage(inputPath, outputPath);
      })
    );

    console.log("所有图片处理完成！");
  } catch (error) {
    console.error("处理文件夹失败:", error);
  }
}

// 主函数
async function main() {
  // 获取用户输入的文件夹路径
  const folderPath = process.argv[2];
  if (!folderPath) {
    console.error("请提供文件夹路径");
    process.exit(1);
  }

  // 处理文件夹
  await processFolder(folderPath);
}

// 运行主函数
main().catch((error) => {
  console.error("程序运行出错:", error);
});



