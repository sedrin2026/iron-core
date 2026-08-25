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

  // マテリアル（青く発光する網目）
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });

  // 関節球体マテリアル
  const jointMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  });

  // 各部位（頭・胸・腹・手足）をリアルな高密度メッシュで合成
  // 頭部
  const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
  headGeo.scale(0.85, 1.15, 0.9);
  const head = new THREE.Mesh(headGeo, wireMaterial);
  head.position.y = 2.1;
  humanGroup.add(head);

  // 胸部（マッチョな胸郭）
  const chestGeo = new THREE.CylinderGeometry(0.7, 0.5, 0.9, 16, 6);
  chestGeo.scale(1.1, 1, 0.7);
  const chest = new THREE.Mesh(chestGeo, wireMaterial);
  chest.position.y = 1.25;
  humanGroup.add(chest);

  // 腹部（くびれと6パック）
  const absGeo = new THREE.CylinderGeometry(0.5, 0.45, 0.7, 16, 6);
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

  // 両腕と肩（左右）
  [-1, 1].forEach(side => {
    // 肩（メロン肩）
    const shoulderGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const shoulder = new THREE.Mesh(shoulderGeo, wireMaterial);
    shoulder.position.set(side * 0.85, 1.5, 0);
    humanGroup.add(shoulder);

    // 上腕
    const armGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.8, 12, 6);
    const arm = new THREE.Mesh(armGeo, wireMaterial);
    arm.position.set(side * 0.95, 0.95, 0);
    arm.rotation.z = side * -0.2;
    humanGroup.add(arm);

    // 前腕
    const foreArmGeo = new THREE.CylinderGeometry(0.16, 0.11, 0.8, 12, 6);
    const foreArm = new THREE.Mesh(foreArmGeo, wireMaterial);
    foreArm.position.set(side * 1.18, 0.2, 0);
    foreArm.rotation.z = side * -0.15;
    humanGroup.add(foreArm);
  });

  // 両脚（左右）
  [-1, 1].forEach(side => {
    // 太もも
    const thighGeo = new THREE.CylinderGeometry(0.28, 0.2, 1.0, 14, 8);
    const thigh = new THREE.Mesh(thighGeo, wireMaterial);
    thigh.position.set(side * 0.32, -0.65, 0);
    thigh.rotation.z = side * -0.05;
    humanGroup.add(thigh);

    // すね・ふくらはぎ
    const calfGeo = new THREE.CylinderGeometry(0.19, 0.12, 1.1, 14, 8);
    const calf = new THREE.Mesh(calfGeo, wireMaterial);
    calf.position.set(side * 0.35, -1.65, 0);
    humanGroup.add(calf);
  });

  scene.add(humanGroup);

  // 3. 足元のSF円形グリッド台座（画像の足元を再現）
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

  // 4. アニメーション（ゆっくり回転してホログラム感を出す）
  function animate() {
    requestAnimationFrame(animate);
    humanGroup.rotation.y += 0.005; // ゆっくり回転
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
