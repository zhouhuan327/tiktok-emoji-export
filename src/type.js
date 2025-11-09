import fs from 'fs'
import path from 'path'

// 指定要遍历的源文件夹路径
const sourceFolderPath = '/Users/zhouhuan/Pictures/抖音表情包导出11.30';

// 获取源文件夹所在目录
const sourceFolderDir = path.dirname(sourceFolderPath);

// 自动创建用于存放GIF图片的文件夹路径
const gifFolderPath = path.join(sourceFolderDir, 'gif_images');
// 自动创建用于存放非GIF图片的文件夹路径
const otherFolderPath = path.join(sourceFolderDir, 'other_images');

// 创建GIF和非GIF图片的目标文件夹（如果不存在）
if (!fs.existsSync(gifFolderPath)) {
    fs.mkdirSync(gifFolderPath);
}
if (!fs.existsSync(otherFolderPath)) {
    fs.mkdirSync(otherFolderPath);
}

// 读取源文件夹中的所有文件
fs.readdirSync(sourceFolderPath).forEach((file) => {
    const filePath = path.join(sourceFolderPath, file);
    const fileExtension = path.extname(file).toLowerCase();

    // 判断是否为图片文件（这里简单通过扩展名判断，可根据实际需求完善）
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
        if (fileExtension === '.gif') {
            // 将GIF图片移动到GIF文件夹
            const newGifPath = path.join(gifFolderPath, file);
            fs.copyFileSync(filePath, newGifPath);
        } else {
            // 将非GIF图片移动到非GIF文件夹
            const newOtherPath = path.join(otherFolderPath, file);
            fs.copyFileSync(filePath, newOtherPath);
        }
    }
});

console.log('分类完成！');