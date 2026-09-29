$ErrorActionPreference = 'Stop'
$encoderPath = 'C:/Users/lenovo/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-essentials_build/bin/ffmpeg.exe'
# Forward-only original footage. Tail/head dissolves hide loop cuts; no procedural
# fog, reversed footage, optical-flow invented frames, or colour modification.
$openingFilter = '[0:v]trim=start_frame=0:end_frame=36,setpts=PTS-STARTPTS,split=2[a][b];[a][b]xfade=transition=fade:duration=0.25:offset=1.25,trim=start=0.25:end=1.5,setpts=PTS-STARTPTS,format=yuv420p[out]'
& $encoderPath -hide_banner -loglevel error -y -i backgroundvideo.mp4 -filter_complex $openingFilter -map '[out]' -an -c:v libx264 -preset fast -crf 17 -r 24 -movflags +faststart assets/opening-native.mp4
if ($LASTEXITCODE -ne 0) { throw 'Opening loop encoding failed' }
& $encoderPath -hide_banner -loglevel error -y -i assets/opening-native.mp4 -vf 'scale=1280:-2' -an -c:v libx264 -preset fast -crf 19 -movflags +faststart assets/opening-native-mobile.mp4
if ($LASTEXITCODE -ne 0) { throw 'Mobile loop encoding failed' }
# The original final room footage supplies the idle indoor motion too.
$interiorFilter = '[0:v]trim=start_frame=120:end_frame=145,setpts=PTS-STARTPTS,split=2[a][b];[a][b]xfade=transition=fade:duration=0.25:offset=0.791666667,trim=start=0.25:end=1.041666667,setpts=PTS-STARTPTS,format=yuv420p[out]'
& $encoderPath -hide_banner -loglevel error -y -i backgroundvideo.mp4 -filter_complex $interiorFilter -map '[out]' -an -c:v libx264 -preset fast -crf 17 -r 24 -movflags +faststart assets/interior-native.mp4
if ($LASTEXITCODE -ne 0) { throw 'Interior loop encoding failed' }
& $encoderPath -hide_banner -loglevel error -y -i assets/interior-native.mp4 -vf 'scale=1280:-2' -an -c:v libx264 -preset fast -crf 19 -movflags +faststart assets/interior-native-mobile.mp4
if ($LASTEXITCODE -ne 0) { throw 'Mobile interior encoding failed' }
Get-ChildItem assets/*native*.mp4 | Select-Object Name,Length
