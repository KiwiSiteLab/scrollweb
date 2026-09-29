/* Two independent clocks: video time selects the camera, uTime animates the environment.
   Masks follow landmarks in the supplied film. This is 2D realtime compositing, not a 3D model. */
window.createLivingScene = function(video, canvas) {
  const gl = canvas.getContext('webgl', {alpha:false, antialias:false, powerPreference:'high-performance'});
  if (!gl) return null;
  const vertex = `attribute vec2 aPosition; varying vec2 vUv;
    void main(){vUv=vec2(aPosition.x*.5+.5,.5-aPosition.y*.5);gl_Position=vec4(aPosition,0.,1.);}`;
  const fragment = `precision highp float;
    varying vec2 vUv;
    uniform sampler2D uVideo;
    uniform vec2 uViewport, uImage;
    uniform float uTime, uProgress;
    uniform vec4 uWater; // back-left x, back-right x, rear y, near-left x
    uniform vec4 uFire; // left, right, baseline-left, baseline-right
    uniform vec4 uWindow;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
    float band(float x,float a,float b,float feather){return smoothstep(a,a+feather,x)*(1.-smoothstep(b-feather,b,x));}
    // Advected density, not displaced photograph. Large eddies carry fine wisps
    // in the same direction, so the fog travels instead of boiling in place.
    float fogDensity(vec2 p, float time, float depth){
      vec2 wind=vec2(time*(.035+depth*.018),time*.003);
      vec2 q=p-wind;
      vec2 eddy=vec2(noise(q*.48+depth*13.7),noise(q*.43+vec2(5.2,depth*8.)))-.5;
      q+=eddy*.72;
      float broad=noise(q);
      float detail=noise(q*2.07+vec2(7.3,4.9));
      float fine=noise(q*4.13+vec2(1.8,9.2));
      float density=broad*.65+detail*.25+fine*.10;
      return smoothstep(.29,.74,density);
    }
    void main(){
      float screenAspect=uViewport.x/uViewport.y, imageAspect=uImage.x/uImage.y;
      vec2 uv=vUv;
      if(screenAspect>imageAspect)uv.y=(uv.y-.5)*(imageAspect/screenAspect)+.5;
      else uv.x=(uv.x-.5)*(screenAspect/imageAspect)+.5;
      vec3 original=texture2D(uVideo,uv).rgb;
      vec2 offset=vec2(0.);

      // Perspective water plane: ripples get wider towards the viewer; banks never deform.
      float waterDepth=clamp((uv.y-uWater.z)/max(.04,1.-uWater.z),0.,1.);
      float left=mix(uWater.x,uWater.w,waterDepth);
      float right=mix(uWater.y,1.-uWater.w,waterDepth);
      float water=band(uv.x,left,right,.015)*smoothstep(uWater.z,uWater.z+.025,uv.y)*(1.-smoothstep(.60,.72,uProgress));
      float wave=sin(uv.y*165.-uTime*2.8+sin(uv.x*29.+uTime*.45)*1.7);
      float wave2=sin(uv.y*295.+uv.x*25.-uTime*4.1);
      offset.y+=(wave*.0032+wave2*.0012)*(.2+waterDepth)*water;
      offset.x+=sin(uv.y*110.+uTime*1.3)*.0015*waterDepth*water;

      // Fog stays in the cloud valleys and beyond the glazing. The source image
      // is never warped by fog, preserving rocks, tree silhouettes and mullions.
      float cool=1.-smoothstep(.075,.21,original.r-original.b);
      float exterior=(1.-smoothstep(.51,.72,uProgress));
      float cloudLeft=(1.-smoothstep(mix(.22,.02,clamp(uProgress*2.,0.,1.)),mix(.29,.05,clamp(uProgress*2.,0.,1.)),uv.x));
      float cloudRight=smoothstep(mix(.82,.99,clamp(uProgress*2.,0.,1.)),mix(.88,1.02,clamp(uProgress*2.,0.,1.)),uv.x);
      float fogRegion=max(cloudLeft,cloudRight)*band(uv.y,.48,1.05,.10)*exterior;
      float windowMask=band(uv.x,uWindow.x,uWindow.y,.032)*band(uv.y,uWindow.z,uWindow.w,.045)*smoothstep(.61,.81,uProgress);
      float luminance=dot(original,vec3(.2126,.7152,.0722));
      float cloudMask=max(fogRegion,windowMask)*cool*smoothstep(.21,.47,luminance);
      // Three depths share a prevailing wind, with subtle relative drift.
      // Stretched vertical coordinates form horizontal veils, not round blobs.
      vec2 fogSpace=vec2(uv.x*7.,uv.y*19.);
      float farFog=fogDensity(fogSpace*.68+vec2(4.,11.),uTime,.15);
      float middleFog=fogDensity(fogSpace+vec2(17.,3.),uTime,.50);
      float nearFog=fogDensity(fogSpace*1.36+vec2(2.,23.),uTime,.85);
      float opticalDepth=farFog*.065+middleFog*.10+nearFog*.075;

      float fallLeft=mix(.849,.865,clamp(uProgress*4.,0.,1.));
      float waterfall=band(uv.x,fallLeft,fallLeft+.062,.012)*band(uv.y,.672,.94,.045)*(1.-smoothstep(.26,.45,uProgress))*cool*smoothstep(.25,.55,original.r+original.b);
      float falling=noise(vec2(uv.x*220.,uv.y*48.-uTime*2.8));
      offset.y+=(falling-.5)*.015*waterfall;

      // Flame deformation is rooted to the existing hearth, not the surrounding wall.
      float fireX=clamp((uv.x-uFire.x)/max(.001,uFire.y-uFire.x),0.,1.);
      float base=mix(uFire.z,uFire.w,fireX);
      float height=base-uv.y;
      float fireArea=band(uv.x,uFire.x,uFire.y,.006)*band(height,-.003,.075,.012)*smoothstep(.62,.78,uProgress);
      float flameNoise=fbm(vec2(fireX*23.+sin(uTime*1.4),height*65.-uTime*3.1));
      float root=smoothstep(-.001,.032,height);
      float flameOnly=smoothstep(.78,.98,original.r)*smoothstep(.35,.72,original.g);
      offset.x+=sin(height*110.-uTime*6.+fireX*22.)*.004*root*fireArea*flameOnly;
      offset.y+=(flameNoise-.45)*.018*root*fireArea*flameOnly;
      vec3 color=texture2D(uVideo,clamp(uv+offset,.001,.999)).rgb;
      float hot=smoothstep(.1,.3,color.r-color.b)*smoothstep(.55,.95,color.r);
      color+=vec3(.17,.075,.012)*(flameNoise-.34)*hot*fireArea;
      // Low frequency fire bounce on the hearth: the room stays solid.
      float glow=band(uv.x,uFire.x-.03,uFire.y+.03,.04)*band(height,-.08,.13,.07)*smoothstep(.65,.83,uProgress);
      color+=vec3(.018,.008,.001)*(sin(uTime*3.7)+sin(uTime*6.1)*.5)*glow;
      // Beer-Lambert transmittance keeps overlapping layers translucent.
      // Sample the local atmospheric colour to inherit the sunset instead of
      // placing a uniform grey/white patch over warm and cool parts alike.
      vec3 localAir=(texture2D(uVideo,clamp(uv+vec2(-.022,.006),.001,.999)).rgb
        +texture2D(uVideo,clamp(uv+vec2(.022,-.006),.001,.999)).rgb)*.5;
      vec3 airTint=mix(vec3(.75,.79,.82),vec3(.96,.79,.62),
        (1.-smoothstep(.12,.67,uv.x))*.48);
      vec3 fogColor=mix(localAir,airTint,.62);
      float mist=(1.-exp(-opticalDepth))*cloudMask;
      color=mix(color,fogColor,mist);
      float glint=(wave+wave2*.4)*.009*water*waterDepth;
      color+=vec3(1.,.81,.59)*glint;
      gl_FragColor=vec4(color,1.);
    }`;
  function shader(type, source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const uniforms=Object.fromEntries(['uVideo','uViewport','uImage','uTime','uProgress','uWater','uFire','uWindow'].map(n=>[n,gl.getUniformLocation(program,n)]));
  gl.uniform1i(uniforms.uVideo,0);
  // Coordinates use the original full image, so masks also align under mobile object-fit cover.
  const landmarks=[
    {p:0, water:[.408,.633,.618,.075],fire:[.505,.531,.589,.589],window:[.38,.62,.50,.60]},
    {p:.25,water:[.423,.606,.636,.12],fire:[.50,.54,.589,.589],window:[.39,.60,.50,.60]},
    {p:.5,water:[.409,.653,.660,-.03],fire:[.53,.56,.62,.62],window:[.39,.62,.49,.61]},
    {p:.65,water:[.26,.77,.90,-.15],fire:[.63,.675,.61,.626],window:[.29,.61,.48,.62]},
    {p:.75,water:[.1,.95,1.02,-.2],fire:[.683,.755,.586,.616],window:[.225,.544,.49,.60]},
    {p:1,water:[.1,.9,1.1,-.2],fire:[.779,.932,.588,.653],window:[.004,.558,.48,.655]}
  ];
  function landmark(p,key){let i=0;while(i<landmarks.length-2&&p>landmarks[i+1].p)i++;const a=landmarks[i],b=landmarks[i+1],f=Math.max(0,Math.min(1,(p-a.p)/(b.p-a.p)));return a[key].map((v,j)=>v+(b[key][j]-v)*f);}
  let lastVideoTime=-1,available=true,dirty=true;
  video.addEventListener('seeked',()=>{dirty=true;});
  video.addEventListener('loadeddata',()=>{dirty=true;});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();available=false;document.body.classList.remove('living-ready');});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  return {
    draw(time){
      if(!available||video.readyState<2)return false;
      const dpr=Math.min(devicePixelRatio,innerWidth<700?1.2:1.4);
      const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      // Upload only when the camera frame changes. Ambient effects require no video decoding.
      if(!video.seeking&&(dirty||video.currentTime!==lastVideoTime)){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,video);lastVideoTime=video.currentTime;dirty=false;}
      if(lastVideoTime<0)return false;
      const p=video.duration?Math.min(1,lastVideoTime/video.duration):0;
      gl.uniform2f(uniforms.uViewport,w,h);gl.uniform2f(uniforms.uImage,video.videoWidth,video.videoHeight);
      gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uProgress,p);
      gl.uniform4fv(uniforms.uWater,landmark(p,'water'));gl.uniform4fv(uniforms.uFire,landmark(p,'fire'));gl.uniform4fv(uniforms.uWindow,landmark(p,'window'));
      gl.drawArrays(gl.TRIANGLES,0,6);
      return true;
    }
  };
};
