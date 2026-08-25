document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. シーン・カメラ・レンダラーの設定
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 8.5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. ホログラム人体のグループを作成
  const humanGroup = new THREE.Group();

  // 基本骨格用マテリアル
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x00aaff,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });

  // 筋肉超強調用マテリアル（明るく光る発光カラー）
  const muscleMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    wireframe: true,
    transparent: true,
    opacity: 1.0
  });

  // 頭部
  const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
  headGeo.scale(0.85, 1.15, 0.9);
  const head = new THREE.Mesh(headGeo, wireMaterial);
  head.position.y = 2.1;
  humanGroup.add(head);

  // 胸部（巨大な大胸筋）
  const chestGeo = new THREE.CylinderGeometry(0.85, 0.6, 1.0, 20, 8);
  chestGeo.scale(1.2, 1, 0.85);
  const chest = new THREE.Mesh(chestGeo, muscleMaterial);
  chest.position.y = 1.25;
  humanGroup.add(chest);

  // 腹部
  const absGeo = new THREE.CylinderGeometry(0.52, 0.45, 0.7, 16, 6);
  absGeo.scale(1.0, 1, 0.65);
  const abs = new THREE.Mesh(absGeo, wireMaterial);
  abs.position.y = 0.55;
  humanGroup.add(abs);

  // 骨盤
  const pelvisGeo = new THREE.CylinderGeometry(0.48, 0.4, 0.5, 16, 4);
  pelvisGeo.scale(1.05, 1, 0.7);
  const pelvis = new THREE.Mesh(pelvisGeo, wireMaterial);
  pelvis.position.y = 0.05;
  humanGroup.add(pelvis);

  // 【筋肉爆盛りアーム】（左右）
  [-1, 1].forEach(side => {
    // 1. 巨大三角筋（巨大メロン肩）
    const shoulderGeo = new THREE.SphereGeometry(0.48, 18, 18);
    shoulderGeo.scale(1.2, 1.3, 1.2);
    const shoulder = new THREE.Mesh(shoulderGeo, muscleMaterial);
    shoulder.position.set(side * 0.95, 1.5, 0);
    humanGroup.add(shoulder);

    // 2. 上腕骨ベース
    const armGeo = new THREE.CylinderGeometry(0.2, 0.18, 0.8, 12, 6);
    const arm = new THREE.Mesh(armGeo, wireMaterial);
    arm.position.set(side * 1.05, 0.95, 0);
    arm.rotation.z = side * -0.22;
    humanGroup.add(arm);

    // 3. 爆コブ上腕二頭筋（力こぶ）
    const bicepsGeo = new THREE.SphereGeometry(0.32, 16, 16);
    bicepsGeo.scale(0.9, 1.5, 1.1);
    const biceps = new THREE.Mesh(bicepsGeo, muscleMaterial);
    biceps.position.set(side * 1.02, 0.95, 0.18);
    biceps.rotation.z = side * -0.22;
    humanGroup.add(biceps);

    // 4. 超太い前腕筋群
    const foreArmGeo = new THREE.CylinderGeometry(0.32, 0.14, 0.9, 18, 10);
    foreArmGeo.scale(1.2, 1.0, 1.0);
    const foreArm = new THREE.Mesh(foreArmGeo, muscleMaterial);
    foreArm.position.set(side * 1.28, 0.15, 0);
    foreArm.rotation.z = side * -0.18;
    humanGroup.add(foreArm);
  });

  // 両脚（左右）
  [-1, 1].forEach(side => {
    const thighGeo = new THREE.CylinderGeometry(0.38, 0.24, 1.0, 16, 8);
    const thigh = new THREE.Mesh(thighGeo, muscleMaterial);
    thigh.position.set(side * 0.35, -0.65, 0);
    thigh.rotation.z = side * -0.05;
    humanGroup.add(thigh);

    const calfGeo = new THREE.CylinderGeometry(0.25, 0.13, 1.1, 14, 8);
    const calf = new THREE.Mesh(calfGeo, muscleMaterial);
    calf.position.set(side * 0.38, -1.65, 0);
    humanGroup.add(calf);
  });

  scene.add(humanGroup);

  // 3. 足元のSF円形グリッド台座
  const ringGeo1 = new THREE.RingGeometry(1.2, 1.23, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = -2.2;
  scene.add(ring1);

  const ringGeo2 = new THREE.RingGeometry(0.7, 0.72, 32);
  const ring2 = new THREE.Mesh(ringGeo2, ringMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = -2.2;
  scene.add(ring2);

  const gridHelper = new THREE.PolarGridHelper(1.8, 16, 8, 64, 0x00e5ff, 0x00e5ff);
  gridHelper.position.y = -2.21;
  gridHelper.material.opacity = 0.25;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // 4. アニメーション
  function animate() {
    requestAnimationFrame(animate);
    humanGroup.rotation.y += 0.006;
    ring1.rotation.z -= 0.003;
    ring2.rotation.z += 0.005;
    renderer.render(scene, camera);
  }
  animate();

  // リサイズ対応
  window.addEventListener('resize', () => {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
});
