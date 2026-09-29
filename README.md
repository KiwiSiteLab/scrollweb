# RIMU 原片动态建筑漫游

运行 npm start 后访问 http://127.0.0.1:4173 。

## 当前实现

首页锁定播放原始 backgroundvideo.mp4 开头 0–1.5 秒。已按原生 24fps 抽取 36 帧，保存在 inspection/opening-frames/，抽帧对照图为 inspection/opening-contact-sheet.jpg。

首页的视频原生播放不依赖滚动：水波、云雾、日光、反射、瀑布都来自原片。已停用 WebGL 雾气、水波和火焰合成。living-scene.js 是旧版存档，页面不再加载。

开头循环片段保留原片分辨率 2052×1008、24fps，约 2 MB；手机采用 1280 像素宽、约 615 KB 的版本。循环只做截取、编码和 0.25 秒首尾融合，不倒放、不插入生成帧、不重新调色。融合后的循环长度 1.25 秒。原片轻微镜头运动也会保留；这不是三维固定机位或无限长度的新视频。

滚动前段保留外景循环，7%–23% 进度逐渐接入原片推进镜头；中段根据滚动定位原片；86%–98% 进度接入原片末段室内循环。室内循环同样保留原片火焰与窗外动态。中间机位停留时仍是当前原片帧，不声称具备每个机位的独立自然循环。

正常页面用轻遮罩保证文字可读；点击“纯享画面”隐藏文字和遮罩，可检查原片色彩。暂停动态冻结当前画面。系统减少动态效果设置默认显示海报，不下载视频。

## 文件

- index.html、style.css、app.js：页面、品牌视觉和原片分层播放。
- assets/opening-native*.mp4：首页原片循环。
- assets/interior-native*.mp4：室内原片循环。
- assets/background-scroll.mp4、assets/background-mobile.mp4：用于滚动定位的全关键帧视频。
- prepare-native-loops.ps1：从原片重新制作循环素材。
- server.mjs：仅监听本机的预览服务，支持视频 Range 请求。
- verify-native.cjs、inspection/native-verification.json：当前版本的浏览器检查与记录；旧版验证脚本及截图仅作历史记录。

设计师资料来自原名片：RIMU Engineering Group Limited / Willson Su / 021 074 9792 / legendchampionstructure@gmail.com。名片原图及微信二维码可在页面弹窗中查看和下载。项目中的源视频、参考视频和名片均保留。

## 检查范围

检查本机 Edge 中的原生循环播放、解码帧持续更新、暂停恢复、滚动衔接、返回首页、模拟手机视口和减少动态设置。不执行真实拨号或发送邮件。尚未部署公网或在实体 iPhone / Android 上验收。
