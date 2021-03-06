
// import libs
const {
	THREE,
	OrbitControls,
	OBJLoader2,
	BufferGeometryUtils,
	LineSegmentsGeometry,
	LineSegments2,
	LineMaterial,
	ConditionalEdgesGeometry,
	ConditionalEdgesShader,
	ConditionalLineSegmentsGeometry,
	ConditionalLineMaterial
} = await window.fetch("~/js/bundle.js");


let renderer,
	camera,
	scene,
	opacity = 0.85,
	lit = false,
	thickness = 1.5,
	useThickLines = true,
	lineColor = 0xbbddff,
	edges = {
		ORIGINAL: false,
		MODEL: false,
		BACKGROUND: false,
		SHADOW: false,
		CONDITIONAL: false
	};


const antcad = {
	init() {
		// fast references
		this.content = window.find("content");
		// init world
		this.dispatch({ type: "init-world" });
	},
	dispatch(event) {
		let Self = antcad,
			loader,
			light,
			model,
			geometry,
			material,
			meshes,
			mesh,
			isOn,
			el;

		switch (event.type) {
			// custom events
			case "previous-model":
			case "next-model":
				break;
			case "toggle-opacity":
				isOn = opacity === 0.85;
				opacity = isOn ? 1 : 0.85;
				Self.dispatch({ type: "post-process-models" });
				return isOn;
			case "toggle-light":
				isOn = lit === false;
				lit = !lit;
				Self.dispatch({ type: "post-process-models" });
				return isOn;
			case "line-thickness":
				break;
			case "line-colors":
				break;
			case "init-world":
				Self.dispatch({ type: "set-up-world" });

				//Self.dispatch({ type: "add-primitive", model: "cylinder" });
				Self.dispatch({ type: "load-model", path: "~/models/drawer.obj" });

				Self.dispatch({ type: "pre-process-models" });
				break;
			case "add-primitive":
				model = new THREE.Group();

				switch (event.model) {
					case "cylinder":
						geometry = new THREE.CylinderBufferGeometry(1, 1, 2, 20);
						break;
					case "torus":
						geometry = new THREE.TorusBufferGeometry(2, .5, 8, 24);
						break;
					case "cone":
						geometry = new THREE.ConeBufferGeometry(1, 2, 10);
						break;
					case "icosahedron":
						geometry = new THREE.IcosahedronBufferGeometry(2, 2);
						break;
					case "octahedron":
						geometry = new THREE.OctahedronBufferGeometry(2);
						break;
					case "dodecahedron":
						geometry = new THREE.DodecahedronBufferGeometry(2);
						break;
				}

				mesh = new THREE.Mesh(geometry);
				model.add(mesh);
				//model.children[0].geometry.computeBoundingBox();
				edges.ORIGINAL = model;
				break;
			case "load-model":
				loader = new OBJLoader2();
				//loader.setLogging(true, true);
				loader.load(event.path, object => {
					object.traverse(child => {
						if (child instanceof THREE.Mesh) {
							model = new THREE.Group();
							model.add(child);
							model.position.set(0, -2, 0);

							//model.children[0].geometry.computeBoundingBox();
							edges.ORIGINAL = model;

							Self.dispatch({ type: "pre-process-models" });
						}
					});
				});
				break;
			case "set-up-world":
				// scene
				scene = new THREE.Scene();
				
				// camera
				camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 2000);
				camera.position.set(-3, 3, 8);
				scene.add(camera);
				
				// renderer
				renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
				renderer.setPixelRatio(window.devicePixelRatio);
				renderer.setSize(window.innerWidth, window.innerHeight);
				Self.content[0].appendChild(renderer.domElement);

				// lights
				light = new THREE.AmbientLight(0xffffff);
				scene.add(light);

				light = new THREE.DirectionalLight(0xffffff, 0.25);
				light.position.set(50, 50, 0);
				//light.target.position.set(-5, 0, 0);
				scene.add(light);
				scene.add(light.target);

				// controls
				let controls = new OrbitControls(camera, renderer.domElement);
				controls.minDistance = 5;
				controls.maxDistance = 15;
				controls.addEventListener("change", Self.render);
				break;
			case "pre-process-models":
				if (!edges.ORIGINAL) return;

				// init edges model
				edges.MODEL = edges.ORIGINAL.clone();
				scene.add(edges.MODEL);

				meshes = [];
				edges.MODEL.traverse(c => c.isMesh ? meshes.push(c) : null);

				meshes.map(mesh => {
					let parent = mesh.parent;
					let lineGeom = new THREE.EdgesGeometry(mesh.geometry, 40);
					let lineMat = new THREE.LineBasicMaterial({ color: lineColor });
					let line = new THREE.LineSegments(lineGeom, lineMat);

					line.position.copy(mesh.position);
					line.scale.copy(mesh.scale);
					line.rotation.copy(mesh.rotation);

					let thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry(lineGeom);
					let thickLineMat = new LineMaterial({ color: lineColor, linewidth: 3 });
					let thickLines = new LineSegments2(thickLineGeom, thickLineMat);

					thickLines.position.copy(mesh.position);
					thickLines.scale.copy(mesh.scale);
					thickLines.rotation.copy(mesh.rotation);
					// hide this for now
					// thickLines.visible = false;

					parent.remove(mesh);
					parent.add(line);
					parent.add(thickLines);
				});
				
				// init background model
				edges.BACKGROUND = edges.ORIGINAL.clone();
				edges.BACKGROUND.traverse(c => {
					if (c.isMesh) {
						c.material = new THREE.MeshBasicMaterial({ color: 0x0066dd });
						c.material.polygonOffset = true;
						c.material.polygonOffsetFactor = 1;
						c.material.polygonOffsetUnits = 1;
						c.receiveShadow = true;
						c.renderOrder = 2;
					}
				});
				scene.add(edges.BACKGROUND);

				// init shadow model
				edges.SHADOW = edges.ORIGINAL.clone();
				edges.SHADOW.traverse(c => {
					if (c.isMesh) {
						c.material = new THREE.MeshStandardMaterial({ color: 0x0066dd, roughness: 1.0 });
						c.material.polygonOffset = true;
						c.material.polygonOffsetFactor = 1;
						c.material.polygonOffsetUnits = 1;
						c.renderOrder = 2;
					}
				});
				scene.add(edges.SHADOW);
				
				// init conditional model
				edges.CONDITIONAL = edges.ORIGINAL.clone();
				scene.add(edges.CONDITIONAL);
				edges.CONDITIONAL.visible = false;

				meshes = [];
				edges.CONDITIONAL.traverse(c => c.isMesh ? meshes.push(c) : null);

				meshes.map(mesh => {
					let parent = mesh.parent;

					// Remove everything but the position attribute
					let mergedGeom = mesh.geometry.clone();
					for (let key in mergedGeom.attributes) {
						if (key !== 'position') {
							mergedGeom.deleteAttribute(key);
						}
					}

					// Create the conditional edges geometry and associated material
					let geomUtil = BufferGeometryUtils.mergeVertices(mergedGeom);
					let lineGeom = new ConditionalEdgesGeometry(geomUtil);
					let material = new THREE.ShaderMaterial(ConditionalEdgesShader);
					material.uniforms.diffuse.value.set(lineColor);

					// Create the line segments objects and replace the mesh
					let line = new THREE.LineSegments(lineGeom, material);
					line.position.copy(mesh.position);
					line.scale.copy(mesh.scale);
					line.rotation.copy(mesh.rotation);

					let thickLineGeom = new ConditionalLineSegmentsGeometry().fromConditionalEdgesGeometry(lineGeom);
					let thickLineMat = new ConditionalLineMaterial({ color: lineColor, linewidth: 2 });
					let thickLines = new LineSegments2(thickLineGeom, thickLineMat);
					thickLines.position.copy(mesh.position);
					thickLines.scale.copy(mesh.scale);
					thickLines.rotation.copy(mesh.rotation);

					parent.remove(mesh);
					parent.add(line);
					parent.add(thickLines);
				});

				Self.dispatch({ type: "post-process-models" });
				break;
			case "post-process-models":
				if (edges.CONDITIONAL) {
					edges.CONDITIONAL.visible = true;
					edges.CONDITIONAL.traverse(c => {
						if (c.material && c.material.resolution) {
							renderer.getSize(c.material.resolution);
							c.material.resolution.multiplyScalar(window.devicePixelRatio);
							c.material.linewidth = thickness;
						}
						if (c.material) {
							c.visible = c.isLineSegments2 ? useThickLines : ! useThickLines;
						}
					} );
				}
				if (edges.MODEL) {
					edges.MODEL.traverse(c => {
						if (c.material && c.material.resolution) {
							renderer.getSize(c.material.resolution);
							c.material.resolution.multiplyScalar(window.devicePixelRatio);
							c.material.linewidth = thickness;
						}
						if (c.material) {
							c.visible = c.isLineSegments2 ? useThickLines : ! useThickLines;
						}
					} );
				}
				if (edges.BACKGROUND) {
					edges.BACKGROUND.visible = ! lit;
					edges.BACKGROUND.traverse(c => {
						if (c.isMesh) {
							c.material.transparent = opacity !== 1.0;
							c.material.opacity = opacity;
						}
					} );
				}
				if (edges.SHADOW) {
					edges.SHADOW.visible = lit;
					edges.SHADOW.traverse(c => {
						if (c.isMesh) {
							c.material.transparent = opacity !== 1.0;
							c.material.opacity = opacity;
						}
					} );
				}
				Self.render();
				break;
		}
	},
	render() {
		renderer.render(scene, camera);
	}
};

window.exports = antcad;
