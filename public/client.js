import * as THREE from 'three'
import { OrbitControls } from './jsm/controls/OrbitControls.js'
import Stats from './jsm/libs/stats.module.js'
import { GUI } from './jsm/libs/lil-gui.module.min.js'

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.z = 2

const renderer = new THREE.WebGLRenderer({antialias: true})
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)

/*const geometry = new THREE.BoxGeometry()
const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)*/

window.addEventListener(
    'resize',
    function () {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
        render()
    },
    false
)

/*const stats = Stats()
document.body.appendChild(stats.dom)

const gui = new GUI()
const cubeFolder = gui.addFolder('Cube')
cubeFolder.add(cube.scale, 'x', -5, 5)
cubeFolder.add(cube.scale, 'y', -5, 5)
cubeFolder.add(cube.scale, 'z', -5, 5)
cubeFolder.open()
const cameraFolder = gui.addFolder('Camera')
cameraFolder.add(camera.position, 'z', 0, 10)
cameraFolder.open()*/


function projectVectorToScreen(vector) {
    const canvas = renderer.domElement;

    vector = vector.clone().project(camera);

    // let mousePos = new THREE.Vector2(event.clientX / renderer.domElement.width, event.clientY / renderer.domElement.height).multiplyScalar(2).subScalar(1).multiply(new THREE.Vector2(1, -1));

    // vector.x = Math.round((0.5 + vector.x / 2) * (canvas.width));
    // vector.y = Math.round((0.5 - vector.y / 2) * (canvas.height));

    return vector;
}

let grid = [];
let tmpgrid = [];

const SIZE = 5;
const N = 25;
const MAXHEIGHT = 2;

for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
        grid.push(i / N * SIZE, j / N * SIZE, 0);
    }
}

function vertexIndex(i, j) {
    return i * N + j;
}


//vertices: [x1, y1, z1, ...]
function heightDataToBufferGeometry(grid) {
    let vertices = [];

    for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < N - 1; j++) {
            const v1Index = vertexIndex(i, j);
            const v2Index = vertexIndex(i + 1, j);
            const v3Index = vertexIndex(i, j + 1);
            const v4Index = vertexIndex(i + 1, j + 1);

            const v1Data = [grid[3 * v1Index], grid[3 * v1Index + 1], grid[3 * v1Index + 2]];
            const v2Data = [grid[3 * v2Index], grid[3 * v2Index + 1], grid[3 * v2Index + 2]];
            const v3Data = [grid[3 * v3Index], grid[3 * v3Index + 1], grid[3 * v3Index + 2]];
            const v4Data = [grid[3 * v4Index], grid[3 * v4Index + 1], grid[3 * v4Index + 2]];

            vertices.push(
                ...v1Data,
                ...v2Data,
                ...v3Data,

                ...v3Data,
                ...v2Data,
                ...v4Data,
            );
        }
    }

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(vertices);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
}

const geometry = heightDataToBufferGeometry(grid); //new THREE.PlaneGeometry(5, 5, 25, 25);

//const material = new THREE.MeshBasicMaterial( { color: 0xffff00, side: THREE.DoubleSide } );
const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader: `
    varying vec3 vWorldPosition;

    void main() {
        vWorldPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `,
    fragmentShader: `
    #define X0 ${SIZE * -0.5}
    #define DX ${SIZE / N}

    varying vec3 vWorldPosition;

    bool within_mod(float val, float target, float delta) {
        return (abs(val - target * round(val / target)) < delta);
    }

    void main() {
        gl_FragColor = vec4(1.0, 0.573, 0.055, 1.0);

        if (within_mod(vWorldPosition.x - X0 - DX / 2.0, DX, 0.005) || within_mod(vWorldPosition.y - X0 - DX / 2.0, DX, 0.005)) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black grid lines
        }

        if (within_mod(vWorldPosition.x - X0 - DX / 2.0, DX, 0.01) && within_mod(vWorldPosition.y - X0 - DX / 2.0, DX, 0.01)) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red points
        }
    }
    `
});

console.log(shaderMaterial.fragmentShader);

const plane = new THREE.Mesh( geometry, shaderMaterial );
plane.position.setX(-SIZE / 2).setY(-SIZE / 2);
scene.add(plane);

scene.add(new THREE.AxesHelper(5));


let isDragging = false;
let draggingIndex = 0;

document.addEventListener('mousedown', (event) => {
    const mouse = new THREE.Vector2();
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    let minI = 0;
    let minJ = 0;
    let minDist = Infinity;

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            const index = 3 * (i * N + j); // z coordinate index
            const x = grid[index];
            const y = grid[index + 1];
            const z = grid[index + 2];

            let dist = mouse.distanceToSquared(projectVectorToScreen(new THREE.Vector3(x, y, z).add(plane.position)));
            
            if (dist < minDist) {
                minI = i;
                minJ = j;
                minDist = dist;
            }
        }
    }

    console.log(event.button);
                
    if ((minDist ** .5) < 0.02) {
        /*console.log(`Clicked on vertex (${minI}, ${minJ}) at distance ${minDist}`);
        grid[3 * (minI * N + minJ) + 2] += (event.button == 0 ? 0.2 : -0.2); // change z coordinate
        const newGeometry = heightDataToBufferGeometry(grid);
        plane.geometry.dispose();
        plane.geometry = newGeometry;*/
        isDragging = true;
        draggingIndex = 3 * (minI * N + minJ);
        
        controls.enabled = false;
    }
});

document.addEventListener('mouseup', (event) => {
    isDragging = false;
    controls.enabled = true;
});

function updatePlaneGeometry() {
    const newGeometry = heightDataToBufferGeometry(grid);
    plane.geometry.dispose();
    plane.geometry = newGeometry;
}

document.addEventListener('mousemove', (event) => {
    if (isDragging) {
        //console.log(event)
        //console.log(draggingIndex, grid[draggingIndex]);

        let minHeight;
        let minDist = Infinity;

        const mouse = new THREE.Vector2();
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

        for (let height = -MAXHEIGHT; height <= MAXHEIGHT; height += 0.05) {
            const x = grid[draggingIndex];
            const y = grid[draggingIndex + 1];
            const z = height;

            let dist = mouse.distanceToSquared(projectVectorToScreen(new THREE.Vector3(x, y, z).add(plane.position)));
            
            if (dist < minDist) {
                minHeight = height;
                minDist = dist;
            }
        }

        grid[draggingIndex + 2] = minHeight;

        updatePlaneGeometry();
    }
});

function animate() {
    requestAnimationFrame(animate)
    /*cube.rotation.x += 0.01
    cube.rotation.y += 0.01
    controls.update()
    render()
    stats.update()*/

    controls.update();

    tmpgrid = grid.slice();

    for (let i = 1; i < N - 1; i++) {
        for (let j = 1; j < N - 1; j++) {
            let index = 3 * vertexIndex(i, j);

            if (isDragging && index == draggingIndex) continue;

            let heightindices = [
                3 * vertexIndex(i - 1, j) + 2,
                3 * vertexIndex(i + 1, j) + 2,
                
                3 * vertexIndex(i, j - 1) + 2,
                3 * vertexIndex(i, j + 1) + 2,
            ];

            let sum = 0;
            for (let hi of heightindices) {
                sum += grid[hi];
            }

            tmpgrid[index + 2] = sum / 4;
        }
    }

    grid = tmpgrid.slice();

    updatePlaneGeometry();

    render();
}

function render() {
    renderer.render(scene, camera)
}

animate()
