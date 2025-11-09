
const imgList = Array.from(
  document.querySelector('.emoji-card-outer-container')?.children[0]?.children[2]?.querySelectorAll("img") || []
).map(item => item.src)

async function downloadImagesAsZip(imgList,name) {
  console.log("表情数量", imgList.length)
  if(!imgList.length) {
    console.log("未找到表情,请确认是否打开表情包弹窗")
    return;
  }
  
  // Dynamically insert JSZip script
  const jsZipScript = document.createElement('script');
  jsZipScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js';
  document.head.appendChild(jsZipScript);

  jsZipScript.onload = async () => {
    const zip = new JSZip();

    const promises = imgList.map(async (src, index) => {
      const response = await fetch(src);
      console.log(`response${index}`,response)
      const blob = await response.blob();
      const type = response.headers.get('content-type')?.includes("gif") ? 'gif' : 'png'
      zip.file(`image${index + 1}.${type}`, blob);
    });

    await Promise.all(promises);
    console.log('promises',promises)
    zip.generateAsync({ type: "blob" }).then(function (content) {
      const a = document.createElement("a");
      const url = window.URL.createObjectURL(content);
      a.href = url;
      a.download = `${name}-表情包导出.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  };
}
downloadImagesAsZip(imgList)

