import { readdir, stat, mkdir } from 'fs/promises';
import { existsSync, createReadStream, createWriteStream, utimes } from 'fs';
import { join, relative, extname, dirname } from 'path';
import { pipeline } from 'stream/promises';
import inquirer from 'inquirer';
import readline from 'readline'; // 新增：用于可靠监听输入

// ==================== 配置常量 ====================
const DEVICES_CONFIG = {
  'action6-SD': {
    sourcePath: '/Volumes/action6/DCIM/DJI_001',
    targetPath: '/Volumes/T7/运动相机',
   ignoreExtensions: ['.LRF']
  },
  'action6': {
    sourcePath: '/Volumes/OsmoAction/DCIM/DJI_001',
    targetPath: '/Volumes/T7/运动相机',
   ignoreExtensions: ['.LRF']
  },
  'Pocket 3': {
    sourcePath: '/Volumes/SD_Card/DCIM/DJI_001',
    targetPath: '/Volumes/T7/pocket3录制',
    ignoreExtensions: ['.LRF']
  },
  'Go Ultra': {
    sourcePath: '/Volumes/goultra/DCIM/Camera01',
    targetPath: '/Volumes/T7/运动相机',
    ignoreExtensions: ['.lrv']
  },
  
  '相机视频': {
    sourcePath: '/Volumes/zve1/PRIVATE/M4ROOT/CLIP',
    targetPath: '/Volumes/T7/相机/视频',
    ignoreExtensions: ['.XML']
  },
  '相机照片': {
    sourcePath: '/Volumes/zve1/DCIM/100MSDCF',
    targetPath: '/Volumes/T7/相机/照片',
    ignoreExtensions: ['.XML']
  }
};

const HIGH_WATER_MARK = 16 * 1024 * 1024; // 16MB（三星T7适配）
const BUFFER_SIZE_DISPLAY = `${HIGH_WATER_MARK / (1024 * 1024)} MB`;
// ================================================

/** 递归收集文件 */
async function collectFiles(dir, ignoreExtensions) {
  const lowerIgnoreExtensions = ignoreExtensions.map(ext => ext.toLowerCase());
  const fileMap = new Map();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(dir, fullPath);
      if (entry.isDirectory()) {
        const subFiles = await collectFiles(fullPath, ignoreExtensions);
        subFiles.forEach((info, path) => fileMap.set(path, info));
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (!lowerIgnoreExtensions.includes(ext)) {
          const stats = await stat(fullPath);
          fileMap.set(relPath, { size: stats.size, mtime: stats.mtime });
        }
      }
    }
  } catch (err) {
    console.warn(`警告：无法访问目录 ${dir}，已跳过`);
  }
  return fileMap;
}

/** 流式拷贝文件（强化停止信号处理） */
async function streamCopyFile(sourcePath, targetPath, originalMtime, totalSize, stopSignal) {
  let readStream, writeStream;
  let speedInterval, progressInterval;
  let lastValidSpeed = 0;
  let isStopped = false; // 本地标记，确保只处理一次停止

  try {
    const targetDir = dirname(targetPath);
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
      console.log(`已创建目标目录：${targetDir}`);
    }

    readStream = createReadStream(sourcePath, { highWaterMark: HIGH_WATER_MARK });
    writeStream = createWriteStream(targetPath);

    // 关键：流错误/关闭时标记停止
    readStream.on('error', (err) => {
      if (err.message.includes('手动停止')) isStopped = true;
    });
    writeStream.on('close', () => {
      if (isStopped) console.log('\n流已关闭，传输终止');
    });

    let transferred = 0;
    let lastTransferred = 0;
    let speed = 0;

    // 计算速度
    speedInterval = setInterval(() => {
      if (isStopped) return;
      const delta = transferred - lastTransferred;
      speed = delta / (1024 * 1024);
      lastTransferred = transferred;
      if (speed > 0.1) lastValidSpeed = speed;
    }, 1000);

    // 刷新进度和ETA
    progressInterval = setInterval(() => {
      if (isStopped || stopSignal.isStopped) return;
      if (transferred < totalSize) {
        const progress = Math.floor((transferred / totalSize) * 100);
        const remainingMB = (totalSize - transferred) / (1024 * 1024);
        const usedSpeed = lastValidSpeed > 0.1 ? lastValidSpeed : speed;
        const etaSeconds = usedSpeed > 0 ? Math.ceil(remainingMB / usedSpeed) : 0;
        const etaFormatted = formatTime(etaSeconds);

        const status = speed < 0.1 
          ? `（等待数据... 预估剩余: ${etaFormatted}）` 
          : `（速度：${speed.toFixed(2)} MB/s，剩余: ${etaFormatted}）`;

        process.stdout.write(
          `\r[缓存大小: ${BUFFER_SIZE_DISPLAY}] 拷贝中: ${progress}% ` +
          `(${formatSize(transferred)}/${formatSize(totalSize)}) ${status} | 输入's'并回车停止传输`
        );
      }
    }, 500);

    // 数据传输时检查停止信号
    readStream.on('data', (chunk) => {
      if (stopSignal.isStopped) {
        isStopped = true;
        readStream.destroy(new Error('用户手动停止传输')); // 立即销毁读流
        return;
      }
      transferred += chunk.length;
    });

    // 实时检查停止信号（10ms一次，高频确保及时响应）
    const stopCheck = setInterval(() => {
      if (stopSignal.isStopped && !isStopped) {
        isStopped = true;
        clearInterval(stopCheck);
        readStream?.destroy(new Error('用户手动停止传输'));
        writeStream?.destroy(); // 同时销毁写流
      }
    }, 10);

    await pipeline(readStream, writeStream);
    clearInterval(stopCheck);

    // 完成提示
    console.log(`\r[缓存大小: ${BUFFER_SIZE_DISPLAY}] 拷贝中: 100% ` +
      `(${formatSize(totalSize)}/${formatSize(totalSize)})（完成）`);

    console.log('\n📅 同步原始修改时间...');
    await new Promise((resolve, reject) => {
      utimes(targetPath, originalMtime, originalMtime, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('✅ 拷贝完成（保留原始时间）');
    return true;

  } catch (err) {
    if (err.message === '用户手动停止传输') {
      console.log('\n⚠️ 传输已被用户手动停止（文件可能不完整，建议重新传输）');
      return false;
    }
    console.error(`\n❌ 传输失败: ${err.message}`);
    return false;
  } finally {
    clearInterval(speedInterval);
    clearInterval(progressInterval);
    readStream?.destroy();
    writeStream?.destroy();
  }
}

/** 同步缺失文件 */
async function syncMissingFiles(sourcePath, targetPath, missingFiles, sourceFileMap, stopSignal) {
  console.log(`\n开始同步 ${missingFiles.length} 个缺失文件...`);
  console.log(`当前缓冲区大小: ${BUFFER_SIZE_DISPLAY}`);
  console.log('提示：传输过程中输入"s"并按回车可立即停止\n');
  const results = { success: [], failed: [], stopped: false };

  for (let i = 0; i < missingFiles.length; i++) {
    if (stopSignal.isStopped) {
      results.stopped = true;
      break;
    }

    const relPath = missingFiles[i];
    const remaining = missingFiles.length - i - 1;
    const sourceFullPath = join(sourcePath, relPath);
    const targetFullPath = join(targetPath, relPath);
    const { size: fileSize, mtime: originalMtime } = sourceFileMap.get(relPath);

    console.log(`\n【文件 ${i + 1}/${missingFiles.length}】处理: ${relPath} (${formatSize(fileSize)})`);
    console.log(`剩余待同步文件: ${remaining} 个`);

    const success = await streamCopyFile(
      sourceFullPath,
      targetFullPath,
      originalMtime,
      fileSize,
      stopSignal
    );

    if (success) results.success.push(relPath);
    else if (!stopSignal.isStopped) results.failed.push(relPath);
  }

  console.log('\n===== 同步总结 =====');
  if (results.stopped) console.log('⚠️ 传输已被手动停止');
  console.log(`✅ 成功: ${results.success.length} 个`);
  if (results.failed.length) {
    console.log(`❌ 失败: ${results.failed.length} 个`);
    results.failed.forEach(path => console.log(`  - ${path}`));
  }
  return results;
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (bytes >= 1024 **3) return`${(bytes / 1024** 3).toFixed(2)} GB`;
  if (bytes >= 1024 **2) return`${(bytes / 1024** 2).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/** 格式化时间（秒 → mm:ss） */
function formatTime(seconds) {
  if (seconds <= 0) return "计算中...";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** 主函数（改用readline监听输入，确保's'被捕获） */
async function main() {
  const stopSignal = { isStopped: false };

  // 关键修复：用readline模块监听输入，更可靠
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  // 监听用户输入（支持's'停止）
  rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 's') {
      stopSignal.isStopped = true;
      console.log('\n已接收到停止指令，正在终止传输...');
    }
  });

  // 监听Ctrl+C强制退出
  process.on('SIGINT', () => {
    console.log('\n用户强制退出');
    rl.close();
    process.exit(1);
  });

  try {
    const { device } = await inquirer.prompt([
      { type: 'list', name: 'device', message: '请选择要同步的设备：', choices: Object.keys(DEVICES_CONFIG) }
    ]);

    const { sourcePath, targetPath, ignoreExtensions } = DEVICES_CONFIG[device];
    console.log(`\n设备信息：`);
    console.log(`- 源设备：${device}（路径：${sourcePath}）`);
    console.log(`- 目标路径：${targetPath}`);
    console.log(`- 忽略的文件后缀：${ignoreExtensions.join(', ')}`);

    if (!existsSync(sourcePath)) throw new Error(`设备未连接：${sourcePath}`);
    if (!existsSync(targetPath)) {
      console.log(`目标路径不存在，将自动创建：${targetPath}`);
      await mkdir(targetPath, { recursive: true });
    }

    console.log('\n收集设备文件信息...');
    const sourceFiles = await collectFiles(sourcePath, ignoreExtensions);
    console.log('收集目标路径文件信息...');
    const targetFiles = await collectFiles(targetPath, ignoreExtensions);

    const missingFiles = [];
    for (const [relPath] of sourceFiles) {
      if (!targetFiles.has(relPath)) missingFiles.push(relPath);
    }

    if (missingFiles.length === 0) {
      console.log('\n✅ 所有文件已同步，无需操作');
      rl.close();
      process.exit(0);
    }

    console.log(`\n===== 发现 ${missingFiles.length} 个缺失文件 =====`);
    missingFiles.forEach((path, index) => console.log(`  ${index + 1}. ${path}`));

    const { confirm } = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: `是否同步以上 ${missingFiles.length} 个文件？`, default: true }
    ]);

    if (confirm) {
      await syncMissingFiles(sourcePath, targetPath, missingFiles, sourceFiles, stopSignal);
    } else {
      console.log('\n已取消同步');
    }

  } catch (err) {
    console.error('\n❌ 执行出错：', err.message);
  } finally {
    rl.close(); // 关闭readline
    process.exit(0);
  }
}

main();