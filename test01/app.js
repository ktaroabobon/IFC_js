import {
    AmbientLight,
    AxesHelper,
    DirectionalLight,
    GridHelper,
    PerspectiveCamera,
    Scene,
    MeshLambertMaterial,
    Raycaster,
    Vector2,
    WebGLRenderer,
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {IFCLoader} from "web-ifc-three/IFCLoader";
import {
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree
} from 'three-mesh-bvh';

//Creates the Three.js scene
const scene = new Scene();

//Object to store the size of the viewport
const size = {
    width: window.innerWidth,
    height: window.innerHeight,
};

//Creates the camera (point of view of the user)
const camera = new PerspectiveCamera(75, size.width / size.height);
camera.position.z = 15;
camera.position.y = 13;
camera.position.x = 8;

//Creates the lights of the scene
const lightColor = 0xffffff;

const ambientLight = new AmbientLight(lightColor, 0.5);
scene.add(ambientLight);

const directionalLight = new DirectionalLight(lightColor, 1);
directionalLight.position.set(0, 10, 0);
directionalLight.target.position.set(-5, 0, 0);
scene.add(directionalLight);
scene.add(directionalLight.target);

//Sets up the renderer, fetching the canvas of the HTML
const threeCanvas = document.getElementById("three-canvas");
const renderer = new WebGLRenderer({canvas: threeCanvas, alpha: true});
renderer.setSize(size.width, size.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//Creates grids and axes in the scene
const grid = new GridHelper(50, 30);
scene.add(grid);

const axes = new AxesHelper();
axes.material.depthTest = false;
axes.renderOrder = 1;
scene.add(axes);

//Creates the orbit controls (to navigate the scene)
const controls = new OrbitControls(camera, threeCanvas);
controls.enableDamping = true;
controls.target.set(-2, 0, 0);

//Animation loop
const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};

animate();

//Adjust the viewport to the size of the browser
window.addEventListener("resize", () => {
    (size.width = window.innerWidth), (size.height = window.innerHeight);
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
});

//Sets up the IFC loading
const ifcModels = [];
const ifcLoader = new IFCLoader();
ifcLoader.ifcManager.setWasmPath("../");

const input = document.getElementById("file-input");
input.addEventListener(
    "change",
    (changed) => {
        const ifcURL = URL.createObjectURL(changed.target.files[0]);
        ifcLoader.load(ifcURL, (ifcModel) => {
            ifcModels.push(ifcModel.mesh);
            scene.add(ifcModel.mesh);
        });
    },
    false
);

// Sets up optimized picking
ifcLoader.ifcManager.setupThreeMeshBVH(
    computeBoundsTree,
    disposeBoundsTree,
    acceleratedRaycast);

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;
const mouse = new Vector2();

function cast(event) {

    // Computes the position of the mouse on the screen
    const bounds = threeCanvas.getBoundingClientRect();

    const x1 = event.clientX - bounds.left;
    const x2 = bounds.right - bounds.left;
    mouse.x = (x1 / x2) * 2 - 1;

    const y1 = event.clientY - bounds.top;
    const y2 = bounds.bottom - bounds.top;
    mouse.y = -(y1 / y2) * 2 + 1;

    // Places it on the camera pointing to the mouse
    raycaster.setFromCamera(mouse, camera);

    // Casts a ray
    return raycaster.intersectObjects(ifcModels);
}

// Creates subset materials
const preselectMat = new MeshLambertMaterial({
    transparent: true,
    opacity: 0.6,
    color: 0xff88ff,
    depthTest: false
})

const selectMat = new MeshLambertMaterial({
    transparent: true,
    opacity: 0.6,
    color: 0xff00ff,
    depthTest: false
})

const ifc = ifcLoader.ifcManager;
// References to the previous selections
const highlightModel = {id: -1};
const selectModel = {id: -1};

function highlight(event, material, model) {
    const found = cast(event)[0];
    if (found) {

        // Gets model ID
        model.id = found.object.modelID;

        // Gets Express ID
        const index = found.faceIndex;
        const geometry = found.object.geometry;
        const id = ifc.getExpressId(geometry, index);

        // Creates subset
        ifcLoader.ifcManager.createSubset({
            modelID: model.id,
            ids: [id],
            material: material,
            scene: scene,
            removePrevious: true
        })
    } else {
        // Remove previous highlight
        ifc.removeSubset(model.id, scene, material);
    }
}

window.onmousemove = (event) => highlight(event, preselectMat, highlightModel);

window.ondblclick = (event) => highlight(event, selectMat, selectModel);

const outputId = document.getElementById("id-output");
const outputType = document.getElementById("type-output");
const outputPset = document.getElementById("pset-output");

function getExpressIdByEvent(found) {
    const index = found.faceIndex;
    const geometry = found.object.geometry;
    const ifc = ifcLoader.ifcManager;
    return ifc.getExpressId(geometry, index);
}

function pickUpId(event) {
    const found = cast(event)[0];
    if (found) {
        const id = getExpressIdByEvent(found)
        console.log(id);
        outputId.innerHTML = id;
    }
}

function pickUpType(event) {
    const found = cast(event)[0];
    if (found) {
        const ifc = ifcLoader.ifcManager;
        const type = ifc.getIfcType(found.object.modelID, getExpressIdByEvent(found));
        console.log(type);
        outputId.innerHTML = type;
    }
}

function pickUpPset(event) {
    const found = cast(event)[0];
    if (found) {
        const ifc = ifcLoader.ifcManager;
        const psets = ifc.getPropertySets(found.object.modelID, getExpressIdByEvent(found));
        for (var i = 0; i < psets.length; i++) {
            console.log(psets[i]);
            outputPset.innerHTML = psets[i];
        }
    }
}

function getInfoByElement(event) {
    pickUpId(event);
    pickUpType(event);
    pickUpPset(event);
}

window.ondblclick = getInfoByElement;
