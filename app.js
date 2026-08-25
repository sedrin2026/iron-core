document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // 1. シーン・カメラ・レンダラーの設定
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 8.0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 2. ホログラム用の青く光るワイヤーフレームマテリアル
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.85
  });

  const brightMaterial = new THREE.MeshBasicMaterial({
    color: 0x33ffff,
    wireframe: true,
    transparent: true,
    opacity: 0.95
  });

  // 全体をまとめるグループ
  const humanGroup = new THREE.Group();

  // ① 頭部
  const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
  headGeo.scale(0.85, 1.2, 0.95);
  const head = new THREE.Mesh(headGeo, wireMaterial);
  head.position.y = 2.15;
  humanGroup.add(head);

  // ② 首
  const neckGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 12);
  const neck = new THREE.Mesh(neckGeo, wireMaterial);
  neck.position.y = 1.72;
  humanGroup.add(neck);

  // ③ 胸郭・大胸筋
  const chestGeo = new THREE.CylinderGeometry(0.75, 0.52, 1.0, 18, 6);
  chestGeo.scale(1.2, 1, 0.8);
  const chest = new THREE.Mesh(chestGeo, brightMaterial);
  chest.position.y = 1.15;
  humanGroup.add(chest);

  // ④ 腹部
  const absGeo = new THREE.CylinderGeometry(0.5, 0.45, 0.75, 16, 6);
  absGeo.scale(1.0, 1, 0.7);
  const abs = new THREE.Mesh(absGeo, wireMaterial);
  abs.position.y = 0.38;
  humanGroup.add(abs);

  // ⑤ 骨盤
  const pelvisGeo = new THREE.CylinderGeometry(0.48, 0.42, 0.5, 16, 4);
  pelvisGeo.scale(1.05, 1, 0.75);
  const pelvis = new THREE.Mesh(pelvisGeo, wireMaterial);
  pelvis.position.y = -0.18;
  humanGroup.add(pelvis);

  // ⑥ 腕パーツ（左右：肩・上腕二頭筋・前腕）
  [-1, 1].forEach(side => {
    // 肩
    const shoulderGeo = new THREE.SphereGeometry(0.32, 14, 14);
    shoulderGeo.scale(1.1, 1.2, 1.1);
    const shoulder = new THREE.Mesh(shoulderGeo, brightMaterial);
    shoulder.position.set(side * 0.88, 1.48, 0);
    humanGroup.add(shoulder);

    // 上腕（上腕二頭筋）
    const armGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.85, 14, 6);
    armGeo.scale(1.0, 1.0, 1.1);
    const arm = new THREE.Mesh(armGeo, wireMaterial);
    arm.position.set(side * 0.98, 0.88, 0.05);
    arm.rotation.z = side * -0.15;
    humanGroup.add(arm);

    // 前腕
    const forearmGeo = new THREE.CylinderGeometry(0.2, 0.12, 0.85, 14, 6);
    forearmGeo.scale(1.1, 1.0, 0.95);
    const forearm = new THREE.Mesh(forearmGeo, wireMaterial);
    forearm.position.set(side * 1.12, 0.08, 0.08);
    forearm.rotation.z = side * -0.08;
    humanGroup.add(forearm);
  });

  // ⑦ 脚パーツ（左右：太もも・ふくらはぎ）
  [-1, 1].forEach(side => {
    // 太もも
    const thighGeo = new THREE.CylinderGeometry(0.32, 0.22, 1.1, 16, 8);
    thighGeo.scale(1.1, 1, 1.1);
    const thigh = new THREE.Mesh(thighGeo, wireMaterial);
    thigh.position.set(side * 0.35, -0.82, 0);
    thigh.rotation.z = side * -0.03;
    humanGroup.add(thigh);

    // ふくらはぎ
    const calfGeo = new THREE.CylinderGeometry(0.22, 0.13, 1.15, 16, 8);
    calfGeo.scale(1.05, 1, 1.1);
    const calf = new THREE.Mesh(calfGeo, wireMaterial);
    calf.position.set(side * 0.38, -1.92, 0);
    humanGroup.add(calf);
  });

  humanGroup.position.y = 0.3;
  scene.add(humanGroup);

  // 3. 足元のSF円形グリッド台座
  const ringGeo1 = new THREE.RingGeometry(1.2, 1.23, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = -2.25;
  scene.add(ring1);

  const ringGeo2 = new THREE.RingGeometry(0.7, 0.72, 32);
  const ring2 = new THREE.Mesh(ringGeo2, ringMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = -2.25;
  scene.add(ring2);

  const gridHelper = new THREE.PolarGridHelper(1.8, 16, 8, 64, 0x00e5ff, 0x00e5ff);
  gridHelper.position.y = -2.26;
  gridHelper.material.opacity = 0.25;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // 4. アニメーション
  function animate() {
    requestAnimationFrame(animate);
    humanGroup.rotation.y += 0.005;
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
