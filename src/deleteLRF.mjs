// deleteLrfFiles.mjs
import { promises as fs } from "node:fs";
import { join } from "node:path";

/**
 * 递归删除指定目录及其子目录中所有 .LRF 文件。
 * @param {string} directoryPath - 要清理的目录路径。
 */
async function deleteLrfFiles(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        // 如果是目录，则递归调用自身
        await deleteLrfFiles(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".LRF") || entry.name.endsWith(".lrv"))) {
        // 如果是文件且以 .LRF 结尾，则删除
        console.log(`正在删除文件: ${fullPath}`);
        await fs.unlink(fullPath);
        console.log(`已删除: ${fullPath}`);
      }
    }
  } catch (error) {
    console.error(`处理目录 ${directoryPath} 时发生错误:`, error);
    // 如果目录不存在，或者没有权限等，这里会捕获错误
  }
}

// --- 使用方法 ---
// 在这里指定你要清理的目录路径
const targetDirectory = "/Volumes/T7"; // 示例：当前目录下的 'your_target_folder'

// 在执行脚本前，请务必确认 targetDirectory 是正确的，避免误删！
console.log(`开始清理目录: ${targetDirectory} 中的 .LRF 文件...`);
deleteLrfFiles(targetDirectory)
  .then(() => {
    console.log("所有 .LRF 文件清理完成！");
  })
  .catch((err) => {
    console.error("清理过程中发生致命错误:", err);
  });

