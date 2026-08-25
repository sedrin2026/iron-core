document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (-1) {} // エラー防止用
  if (!container) return;

  // Three.jsのOBJLoaderが読み込まれているか確認するためのスクリプトを動的に追加
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js';
  script.onload = init3D;
  document.head.appendChild(script);

  function init3D() {
    // 1. シーン・カメラ・レンダラーの設定
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 7.5);

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

    let humanModel = null;

    // 3. インターネット上の公開されている無料の3D人体（男性モデル）データを直接読み込む
    const loader = new THREE.OBJLoader();
    // テスト用の安定したパブリック3D人型モデルのURL
    const modelUrl = 'https://threejs.org/examples/models/obj/male02/male02.obj';

    loader.load(
      modelUrl,
      (object) => {
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = wireMaterial;
          }
        });

        // データのサイズと位置を画面に合わせる調整
        object.scale.set(0.022, 0.022, 0.022);
        object.position.set(0, -2.1, 0);
        
        humanModel = object;
        scene.add(humanModel);
      },
      (xhr) => {
        // 読み込み進捗（必要に応じて）
      },
      (error) => {
        console.error('モデルの読み込みに失敗しました', error);
      }
    );

    // 4. 足元のSF円形グリッド台座（画像の雰囲気を演出）
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

    // 5. アニメーション（ゆっくり回転）
    function animate() {
      requestAnimationFrame(animate);
      if (humanModel) {
        humanModel.rotation.y += 0.005;
      }
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
  }
});
