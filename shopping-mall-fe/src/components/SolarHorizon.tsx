import { useEffect, useRef } from "react";
import * as THREE from "three";

type SolarUniforms = {
  uTime: { value: number };
  uAspect: { value: number };
  uGlow: { value: number };
};

export function SolarHorizon() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const uniforms: SolarUniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uGlow: { value: 1 },
    };

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      const activeRenderer = renderer;
      activeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      activeRenderer.setClearColor(0x000000, 0);
      activeRenderer.outputColorSpace = THREE.SRGBColorSpace;
      activeRenderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(activeRenderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
      camera.position.z = 2;
      const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `
          uniform float uTime; uniform float uAspect; uniform float uGlow; varying vec2 vUv;
          void main(){
            vec2 p=vec2((vUv.x-.5)*uAspect,vUv.y-.487); float d=length(p);
            float pulse=.94+.06*sin(uTime*1.05); float core=1.0-smoothstep(.008*pulse,.013*pulse,d);
            float tightHalo=exp(-d*32.0); float wideHalo=exp(-d*9.5);
            float beam=exp(-abs(p.y)*96.0)*exp(-abs(p.x)*1.65);
            float angle=atan(p.y,p.x); float rays=pow(max(cos(angle*4.0+.12*sin(uTime*.32)),0.0),22.0)*exp(-d*16.0);
            float shimmer=.96+.04*sin(uTime*.8+p.x*13.0);
            float glow=(tightHalo*.66+wideHalo*.42+beam*.34+rays*.09)*uGlow*pulse*shimmer;
            float alpha=clamp(core*.92+glow,0.0,.98);
            vec3 color=mix(vec3(1.0,.43,.22),vec3(1.0,.88,.62),smoothstep(.002,.012,d));
            gl_FragColor=vec4(color*alpha,alpha);
          }`,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(plane);
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.019, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xfff3cf, toneMapped: false }),
      );
      sun.position.set(0, -0.026, 0.08);
      scene.add(sun);

      const render = (time = 0) => {
        uniforms.uTime.value = time * 0.001;
        sun.scale.setScalar(1 + Math.sin(uniforms.uTime.value * 1.05) * 0.035);
        activeRenderer.render(scene, camera);
      };
      const animate = (time: number) => {
        render(time);
        if (!reducedMotion.matches && !document.hidden) frameId = requestAnimationFrame(animate);
      };
      const resize = () => {
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        const aspect = width / height;
        uniforms.uAspect.value = aspect;
        camera.left = -aspect;
        camera.right = aspect;
        camera.updateProjectionMatrix();
        plane.geometry.dispose();
        plane.geometry = new THREE.PlaneGeometry(aspect * 2, 2);
        activeRenderer.setSize(width, height, false);
        render(performance.now());
      };
      const resizeObserver = new ResizeObserver(resize);
      const onVisibilityChange = () => {
        cancelAnimationFrame(frameId);
        if (!document.hidden && !reducedMotion.matches) frameId = requestAnimationFrame(animate);
      };
      const onMotionChange = () => {
        cancelAnimationFrame(frameId);
        if (reducedMotion.matches) render(performance.now());
        else frameId = requestAnimationFrame(animate);
      };
      resizeObserver.observe(mount);
      document.addEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.addEventListener("change", onMotionChange);
      resize();
      if (!reducedMotion.matches) frameId = requestAnimationFrame(animate);
      mount.dataset.webgl = "ready";

      return () => {
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibilityChange);
        reducedMotion.removeEventListener("change", onMotionChange);
        plane.geometry.dispose();
        material.dispose();
        sun.geometry.dispose();
        (sun.material as THREE.Material).dispose();
        activeRenderer.dispose();
        activeRenderer.domElement.remove();
      };
    } catch {
      mount.dataset.webgl = "fallback";
      return () => {
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    }
  }, []);

  return (
    <div className="solar-layer" ref={mountRef} aria-hidden="true">
      <div className="solar-fallback" />
    </div>
  );
}
