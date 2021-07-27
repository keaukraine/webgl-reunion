import { BaseRenderer, FullModel, UncompressedTextureLoader, DiffuseShader, CombinedAnimation } from "webgl-framework";
import { mat4, vec3 } from "gl-matrix";
import { DiffuseColoredShader } from "./shaders/DiffuseColoredShader";
import { CameraMode } from "./CameraMode";
import { CameraPositionInterpolator } from "./CameraPositionInterpolator";
import { DiffuseAlphaShader } from "./shaders/DiffuseAlphaShader";
import { DiffuseAnimatedTextureShader } from "./shaders/DiffuseAnimatedTextureShader";
import { DiffuseAnimatedTextureChunkedShader } from "./shaders/DiffuseAnimatedTextureChunkedShader";
import { TextureAnimationChunked } from "./TextureAnimationChunked";
import { PointSpriteColoredShader } from "./shaders/PointSpriteColoredShader";

const FOV_LANDSCAPE = 60.0; // FOV for landscape
const FOV_PORTRAIT = 70.0; // FOV for portrait
const YAW_COEFF_NORMAL = 200.0; // camera rotation time

export class Renderer extends BaseRenderer {
    private lastTime = 0;
    private angleYaw = 0;

    private loaded = false;

    private fmSky = new FullModel();
    private fmStatic = new FullModel();
    private fmSquirrel = new FullModel();
    private fmDryad = new FullModel();
    private fmBook = new FullModel();
    private fmProps = new FullModel();
    private fmBrick1 = new FullModel();
    private fmBrick2 = new FullModel();
    private fmBrick3 = new FullModel();
    private fmBrick4 = new FullModel();
    private fmCandle = new FullModel();
    private fmFlame = new FullModel();
    private fmDust = new FullModel();

    private textureSky: WebGLTexture | undefined;
    private textureStatic: WebGLTexture | undefined;
    private textureSquirrel: WebGLTexture | undefined;
    private textureDryad: WebGLTexture | undefined;
    private textureFlameDiffuse: WebGLTexture | undefined;
    private textureFlameAlpha: WebGLTexture | undefined;
    private textureDust: WebGLTexture | undefined;
    private texturesSquirrelAnim: WebGLTexture[] = [];
    private texturesDryadAnim: WebGLTexture[] = [];
    private texturesBookAnim: WebGLTexture[] = [];
    private texturePropsAnim: WebGLTexture | undefined;

    private shaderDiffuse: DiffuseShader | undefined;
    private shaderDiffuseAnimatedTexture: DiffuseAnimatedTextureShader | undefined;
    private shaderDiffuseAnimatedTextureChunked: DiffuseAnimatedTextureChunkedShader | undefined;
    private shaderDiffuseAlpha: DiffuseAlphaShader | undefined;
    private shaderDiffuseColored: DiffuseColoredShader | undefined;
    private shaderPointSpriteColored: PointSpriteColoredShader | undefined;

    private customCamera: mat4 | undefined;

    private Z_NEAR = 5.0;
    private Z_FAR = 500.0;

    private timerFlamesFlicker = 0;
    private FLAME_FLICKER_SPEED = 700;
    private timerDustRotation = 0;
    private DUST_ROTATION_SPEED = 12003333;
    private timerBrickAnimation1 = 0;
    private timerBrickAnimation2 = 0;
    private BRICK_ANIMATION_PERIOD1 = 8000;
    private BRICK_ANIMATION_PERIOD2 = 10000;
    private timerPropsAnimation = 0;
    private PROPS_ANIMATION_PERIOD = 50000;
    private timerCharactersAnimation = 0;
    private SQUIRREL_ANIMATION_PERIOD = 5000;

    private readonly ANIMATION_TEXTURE_WIDTH = 1000;

    private animationsSquirrel = [
        new TextureAnimationChunked(this.ANIMATION_TEXTURE_WIDTH, 3521, 9),
        new TextureAnimationChunked(this.ANIMATION_TEXTURE_WIDTH, 3521, 9)
    ];
    private animationsDryad = [
        new TextureAnimationChunked(this.ANIMATION_TEXTURE_WIDTH, 5075, 10),
        new TextureAnimationChunked(this.ANIMATION_TEXTURE_WIDTH, 5075, 9)
    ];
    private animationsBook = [
        new TextureAnimationChunked(179, 179, 9),
        new TextureAnimationChunked(179, 179, 9)
    ];
    private animationProps = new TextureAnimationChunked(this.ANIMATION_TEXTURE_WIDTH, 15277, 12);

    private animationPreset = 0;

    private cameraMode = CameraMode.Random;

    private currentRandomCamera = 0;

    protected matViewInverted = mat4.create();
    protected matViewInvertedTransposed = mat4.create();
    protected matTemp = mat4.create();
    protected cameraPosition = vec3.create();
    protected cameraRotation = vec3.create();

    // -y x z
    private readonly STATIC_FLAMES = [
        [0.16, 0.829, 1.699],
        [0.287, 0.678, 1.48],
        [0.104, 1.005, 1.76],
        [-0.884, -2.451, 8.21]
    ];

    private CAMERAS = [
        {
            start: {
                position: new Float32Array([-28.095890045166016, 12.225852012634277, 26.799631118774414]),
                rotation: new Float32Array([0.671999990940094, 2.014841079711914, 0])
            },
            end: {
                position: new Float32Array([-118.26929473876953, 55.12385559082031, 106.23757934570312]),
                rotation: new Float32Array([0.671999990940094, 2.014841079711914, 0])
            },
            speedMultiplier: 1.0
        },
        {
            start: {
                position: new Float32Array([24.948617935180664, 17.682157516479492, 13.680034637451172]),
                rotation: new Float32Array([-0.16200000047683716, 3.468000650405884, 0])
            },
            end: {
                position: new Float32Array([24.948617935180664, 17.682157516479492, 13.680034637451172]),
                rotation: new Float32Array([-0.15600000321865082, 5.532010078430176, 0])
            },
            speedMultiplier: 1.0
        },
        {
            start: {
                position: new Float32Array([18.938369750976562, -109.97211456298828, -30.183963775634766]),
                rotation: new Float32Array([-0.16199995577335358, 6.006017208099365, 0])
            },
            end: {
                position: new Float32Array([69.24081420898438, 103.69456481933594, 42.98187255859375]),
                rotation: new Float32Array([0.060000013560056686, 3.8640007972717285, 0])
            },
            speedMultiplier: 1.2
        },
        {
            start: {
                position: new Float32Array([10.01757526397705, 83.99954986572266, -74.53765106201172]),
                rotation: new Float32Array([-0.33600011467933655, 3.2400097846984863, 0])
            },
            end: {
                position: new Float32Array([71.44377899169922, 82.80711364746094, 106.30229187011719]),
                rotation: new Float32Array([0.3119998872280121, 3.8280138969421387, 0])
            },
            speedMultiplier: 1.4
        },
        {
            start: {
                position: new Float32Array([-55.866207122802734, -37.043373107910156, 105.39311981201172]),
                rotation: new Float32Array([0.4860006272792816, 1.1651625633239746, 0])
            },
            end: {
                position: new Float32Array([-31.941368103027344, 19.724849700927734, 61.8049201965332]),
                rotation: new Float32Array([-0.25199952721595764, 2.5031683444976807, 0])
            },
            speedMultiplier: 0.6
        },
        {
            start: {
                position: new Float32Array([-74.49573516845703, -83.4346694946289, 110.20716857910156]),
                rotation: new Float32Array([0.2819996178150177, 0.7379963994026184, 0])
            },
            end: {
                position: new Float32Array([-23.572843551635742, -27.439706802368164, 88.27853393554688]),
                rotation: new Float32Array([0.2819996178150177, 0.7379963994026184, 0])
            },
            speedMultiplier: 0.6
        },
        {
            start: {
                position: new Float32Array([20.9195613861084, -34.834861755371094, 48.75697708129883]),
                rotation: new Float32Array([-0.4860008955001831, 5.4491777420043945, 0])
            },
            end: {
                position: new Float32Array([-11.682619094848633, 28.2702579498291, 102.74195098876953]),
                rotation: new Float32Array([0.7139993906021118, 3.0851686000823975, 0])
            },
            speedMultiplier: 0.6
        },
        {
            start: {
                position: new Float32Array([34.9512825012207, -6.195713520050049, 85.75748443603516]),
                rotation: new Float32Array([0.2699999213218689, 4.404007434844971, 0])
            },
            end: {
                position: new Float32Array([-36.0273551940918, 18.815990447998047, 74.50830841064453]),
                rotation: new Float32Array([0.07200007140636444, 2.424006938934326, 0])
            },
            speedMultiplier: 0.55
        },
        {
            start: {
                position: new Float32Array([-43.43503952026367, 11.896408081054688, 109.91748046875]),
                rotation: new Float32Array([0.6359999179840088, 2.0940022468566895, 0])
            },
            end: {
                position: new Float32Array([-31.17324447631836, -60.02818298339844, 111.58064270019531]),
                rotation: new Float32Array([0.6179999709129333, 0.5280007719993591, 0])
            },
            speedMultiplier: 0.55
        },
        {
            start: {
                position: new Float32Array([-38.833065032958984, 18.838245391845703, 22.54474449157715]),
                rotation: new Float32Array([0.20999987423419952, 2.0639989376068115, 0])
            },
            end: {
                position: new Float32Array([-39.68904113769531, -62.57891845703125, 24.37496566772461]),
                rotation: new Float32Array([-0.16200003027915955, 0.8039959669113159, 0])
            },
            speedMultiplier: 0.5
        },
        {
            start: {
                position: new Float32Array([26.631803512573242, -62.593048095703125, 34.585960388183594]),
                rotation: new Float32Array([0.054000161588191986, 5.388018608093262, 0])
            },
            end: {
                position: new Float32Array([24.26614761352539, 78.08656311035156, 25.982101440429688]),
                rotation: new Float32Array([0.04800016060471535, 4.002010822296143, 0])
            },
            speedMultiplier: 1.0
        },
        {
            start: {
                position: new Float32Array([-84.5576171875, -32.41253662109375, -68.05702209472656]),
                rotation: new Float32Array([-0.4860002100467682, 1.0799976587295532, 0])
            },
            end: {
                position: new Float32Array([-31.919471740722656, 84.85850524902344, 88.84742736816406]),
                rotation: new Float32Array([0.4860002100467682, 2.8260018825531006, 0])
            },
            speedMultiplier: 0.66
        },
        {
            start: {
                position: new Float32Array([61.83866500854492, 72.85232543945312, 50.390113830566406]),
                rotation: new Float32Array([0.09599965810775757, 4.0500054359436035, 0])
            },
            end: {
                position: new Float32Array([-54.98536682128906, 88.33901977539062, 48.588111877441406]),
                rotation: new Float32Array([0.13799963891506195, 2.6040050983428955, 0])
            },
            speedMultiplier: 1.0
        },
        {
            start: {
                position: new Float32Array([-28.869665145874023, 71.51769256591797, 72.98783874511719]),
                rotation: new Float32Array([0.2279999852180481, 2.147998332977295, 0])
            },
            end: {
                position: new Float32Array([-22.950647354125977, 21.49327278137207, 86.47998809814453]),
                rotation: new Float32Array([0.504000186920166, 0.4979982078075409, 0])
            },
            speedMultiplier: 1.0
        },
        {
            start: {
                position: new Float32Array([34.202938079833984, 92.24118041992188, 38.82014846801758]),
                rotation: new Float32Array([0.28199976682662964, 3.780001640319824, 0])
            },
            end: {
                position: new Float32Array([-36.741512298583984, 82.78315734863281, 84.25780487060547]),
                rotation: new Float32Array([0.18599973618984222, 2.9579968452453613, 0])
            },
            speedMultiplier: 1.0
        },
    ];

    private readonly CAMERA_SPEED = 0.01;
    private readonly CAMERA_MIN_DURATION = 8000;

    private cameraPositionInterpolator = new CameraPositionInterpolator();

    private readonly SCALE = 10;

    private dustSpriteSize = 0;
    private DUST_COLOR = { r: 20 / 256, g: 18 / 256, b: 15 / 256, a: 1 };
    private DUST_SPRITE_SIZE = 0.006;
    private DUST_SCALE = 0.65;

    constructor() {
        super();
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED;
        this.cameraPositionInterpolator.minDuration = this.CAMERA_MIN_DURATION;
        this.randomizeCamera();

        document.addEventListener("keypress", event => {
            if (event.key === "1") {
                this.CAMERAS[0].start = {
                    position: new Float32Array([this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]]),
                    rotation: new Float32Array([this.cameraRotation[0], this.cameraRotation[1], this.cameraRotation[2]]),
                }
                this.logCamera();
            } else if (event.key === "2") {
                this.CAMERAS[0].end = {
                    position: new Float32Array([this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]]),
                    rotation: new Float32Array([this.cameraRotation[0], this.cameraRotation[1], this.cameraRotation[2]]),
                }
                this.logCamera();
            }
        });
    }

    private logCamera() {
        const camera = this.CAMERAS[0];
        console.log(`
        {
            start: {
                position: new Float32Array([${camera.start.position.toString()}]),
                rotation: new Float32Array([${camera.start.rotation.toString()}])
            },
            end: {
                position: new Float32Array([${camera.end.position.toString()}]),
                rotation: new Float32Array([${camera.end.rotation.toString()}])
            },
            speedMultiplier: 1.0
        },
        `);
    }

    setCustomCamera(camera: mat4 | undefined, position?: vec3, rotation?: vec3) {
        this.customCamera = camera;

        // console.log(position, rotation);

        if (position !== undefined) {
            this.cameraPosition = position;
        }
        if (rotation !== undefined) {
            this.cameraRotation = rotation;
        }
    }

    resetCustomCamera() {
        this.customCamera = undefined;
    }

    onBeforeInit(): void {
    }

    onAfterInit(): void {
    }

    onInitError(): void {
        document.getElementById("canvasGL")?.classList.add("hidden");
        document.getElementById("alertError")?.classList.remove("hidden");
    }

    initShaders(): void {
        this.shaderDiffuse = new DiffuseShader(this.gl);
        this.shaderDiffuseAnimatedTexture = new DiffuseAnimatedTextureShader(this.gl);
        this.shaderDiffuseAnimatedTextureChunked = new DiffuseAnimatedTextureChunkedShader(this.gl);
        this.shaderDiffuseAlpha = new DiffuseAlphaShader(this.gl);
        this.shaderDiffuseColored = new DiffuseColoredShader(this.gl);
        this.shaderPointSpriteColored = new PointSpriteColoredShader(this.gl);
    }

    async loadFloatingPointTexture(
        url: string,
        gl: WebGL2RenderingContext,
        width: number,
        height: number,
        minFilter = gl.LINEAR,
        magFilter = gl.LINEAR,
        clamp = false
    ): Promise<WebGLTexture> {
        const texture = gl.createTexture();

        if (texture === null) {
            throw new Error("Error creating WebGL texture");
        }

        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const dataView = new Uint16Array(data);
        // const dataView = new Float32Array(data);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        this.checkGlError("loadFloatingPointTexture 0");
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, width, height, 0, gl.RGB, gl.HALF_FLOAT, dataView);
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, width, height, 0, gl.RGB, gl.FLOAT, dataView);
        this.checkGlError("loadFloatingPointTexture 1");
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        if (clamp === true) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }
        this.checkGlError("loadFloatingPointTexture 2");
        gl.bindTexture(gl.TEXTURE_2D, null);

        console.log(`Loaded texture ${url} [${width}x${height}]`);

        return texture;
    }

    async loadData(): Promise<void> {
        await Promise.all([
            this.fmSky.load("data/models/sky", this.gl),
            this.fmStatic.load("data/models/static", this.gl),
            this.fmProps.load("data/models/anims/movable", this.gl),
            this.fmSquirrel.load("data/models/anims/squirrel", this.gl),
            this.fmDryad.load("data/models/anims/character", this.gl),
            this.fmBook.load("data/models/anims/book", this.gl),
            this.fmBrick1.load("data/models/brick1", this.gl),
            this.fmBrick2.load("data/models/brick2", this.gl),
            this.fmBrick3.load("data/models/brick3", this.gl),
            this.fmBrick4.load("data/models/brick4", this.gl),
            this.fmCandle.load("data/models/candle", this.gl),
            this.fmFlame.load("data/models/flame-single", this.gl),
            this.fmDust.load("data/models/particles_20", this.gl)
        ]);

        [
            this.textureSky,
            this.textureStatic,
            this.textureFlameDiffuse,
            this.textureFlameAlpha,
            this.textureDust,
            this.textureSquirrel,
            this.textureDryad,
            this.texturesSquirrelAnim[0],
            this.texturesSquirrelAnim[1],
            this.texturesDryadAnim[0],
            this.texturesDryadAnim[1],
            this.texturesBookAnim[0],
            this.texturesBookAnim[1],
            this.texturePropsAnim
        ] = await Promise.all([
            UncompressedTextureLoader.load("data/textures/sky.jpg", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/baked_all_combined.jpg", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/flame.png", this.gl, this.gl.LINEAR, this.gl.LINEAR, false),
            UncompressedTextureLoader.load("data/textures/flame-alpha.png", this.gl, this.gl.LINEAR, this.gl.LINEAR, false),
            UncompressedTextureLoader.load("data/textures/dust.png", this.gl, this.gl.LINEAR, this.gl.LINEAR, false),
            UncompressedTextureLoader.load("data/textures/squirrel.jpg", this.gl, this.gl.LINEAR, this.gl.LINEAR, false),
            UncompressedTextureLoader.load("data/textures/dryad.jpg", this.gl, this.gl.LINEAR, this.gl.LINEAR, false),
            this.loadFloatingPointTexture(
                `data/textures/squirrel1.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsSquirrel[0].textureWidth, this.animationsSquirrel[0].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                `data/textures/squirrel2.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsSquirrel[1].textureWidth, this.animationsSquirrel[1].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                `data/textures/character1.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsDryad[0].textureWidth, this.animationsDryad[0].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                `data/textures/character2.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsDryad[1].textureWidth, this.animationsDryad[1].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                `data/textures/book1.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsBook[0].textureWidth, this.animationsBook[0].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                `data/textures/book2.rgb.fp16`,
                this.gl as WebGL2RenderingContext,
                this.animationsBook[1].textureWidth, this.animationsBook[1].textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            ),
            this.loadFloatingPointTexture(
                "data/textures/movable.rgb.fp16",
                this.gl as WebGL2RenderingContext,
                this.animationProps.textureWidth, this.animationProps.textureHeight,
                this.gl.NEAREST, this.gl.NEAREST,
                true
            )
        ]);

        this.loaded = true;
        console.log("Loaded all assets");

        document.getElementById("message")?.classList.add("hidden");
        document.getElementById("canvasGL")?.classList.remove("transparent");
        setTimeout(() => document.querySelector(".promo")?.classList.remove("transparent"), 1800);
        setTimeout(() => document.querySelector("#toggleFullscreen")?.classList.remove("transparent"), 1800);
    }

    async changeScene(): Promise<void> {
        this.animationPreset = (this.animationPreset + 1) % 2;
    }

    animate(): void {
        const timeNow = new Date().getTime();

        if (this.lastTime != 0) {
            const elapsed = timeNow - this.lastTime;

            this.angleYaw += elapsed / YAW_COEFF_NORMAL;
            this.angleYaw %= 360.0;

            this.timerFlamesFlicker = (timeNow % this.FLAME_FLICKER_SPEED) / this.FLAME_FLICKER_SPEED;
            this.timerDustRotation = (timeNow % this.DUST_ROTATION_SPEED) / this.DUST_ROTATION_SPEED;
            this.timerBrickAnimation1 = (timeNow % this.BRICK_ANIMATION_PERIOD1) / this.BRICK_ANIMATION_PERIOD1;
            this.timerBrickAnimation2 = (timeNow % this.BRICK_ANIMATION_PERIOD2) / this.BRICK_ANIMATION_PERIOD2;
            this.timerPropsAnimation = (timeNow % this.PROPS_ANIMATION_PERIOD) / this.PROPS_ANIMATION_PERIOD;
            this.timerCharactersAnimation = (timeNow % this.SQUIRREL_ANIMATION_PERIOD) / this.SQUIRREL_ANIMATION_PERIOD;

            this.cameraPositionInterpolator.iterate(timeNow);
            if (this.cameraPositionInterpolator.timer === 1.0) {
                this.randomizeCamera();
            }
        }

        this.lastTime = timeNow;
    }

    /** Calculates projection matrix */
    setCameraFOV(multiplier: number): void {
        var ratio;

        if (this.gl.canvas.height > 0) {
            ratio = this.gl.canvas.width / this.gl.canvas.height;
        } else {
            ratio = 1.0;
        }

        let fov = 0;
        if (this.gl.canvas.width >= this.gl.canvas.height) {
            fov = FOV_LANDSCAPE * multiplier;
        } else {
            fov = FOV_PORTRAIT * multiplier;
        }

        this.setFOV(this.mProjMatrix, fov, ratio, this.Z_NEAR, this.Z_FAR);

        this.dustSpriteSize = Math.min(this.gl.canvas.height, this.gl.canvas.width) * this.DUST_SPRITE_SIZE;
    }

    /**
     * Calculates camera matrix.
     *
     * @param a Position in [0...1] range
     */
    private positionCamera(a: number) {
        if (this.customCamera !== undefined) {
            this.mVMatrix = this.customCamera;
            return;
        }

        if (this.cameraMode === CameraMode.Random) {
            this.mVMatrix = this.cameraPositionInterpolator.matrix;
            this.cameraPosition[0] = this.cameraPositionInterpolator.cameraPosition[0];
            this.cameraPosition[1] = this.cameraPositionInterpolator.cameraPosition[1];
            this.cameraPosition[2] = this.cameraPositionInterpolator.cameraPosition[2];
        } else {
            const a = this.angleYaw / 360 * Math.PI * 2;
            const sina = Math.sin(a);
            const cosa = Math.cos(a);
            const cosa2 = Math.cos(a * 2);

            this.cameraPosition[0] = sina * 120;
            this.cameraPosition[1] = cosa * 120;
            this.cameraPosition[2] = 50 + cosa2 * 30;

            mat4.lookAt(this.mVMatrix,
                this.cameraPosition, // eye
                [0, 0, 40], // center
                [0, 0, 1] // up vector
            );
            // mat4.rotate(this.mVMatrix, this.mVMatrix, (this.angleYaw + 280) / 160.0 * 6.2831852, [0, 0, 1]);
        }
    }

    /** Issues actual draw calls */
    drawScene() {
        if (!this.loaded) {
            return;
        }

        this.positionCamera(0.0);
        this.setCameraFOV(1.0);

        this.gl.clearColor(0.0, 0.5, 0.0, 1.0);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);

        this.gl.colorMask(true, true, true, true);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // This differs from OpenGL ES
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.drawSceneObjects();
    }

    private drawSceneObjects(): void {
        if (this.shaderDiffuse === undefined
            || this.shaderDiffuseAlpha === undefined
            || this.shaderDiffuseAnimatedTexture === undefined
            || this.shaderDiffuseAnimatedTextureChunked === undefined
            || this.shaderDiffuseColored === undefined
        ) {
            console.log("undefined shaders");
            return;
        }

        this.gl.cullFace(this.gl.BACK);
        this.gl.disable(this.gl.BLEND);

        this.shaderDiffuse.use();

        this.setTexture2D(0, this.textureStatic!, this.shaderDiffuse.sTexture!);
        this.shaderDiffuse.drawModel(this, this.fmStatic, 0, 0, 0, 0, 0, 0, this.SCALE, this.SCALE, this.SCALE);

        const rotation_a = Math.sin(this.timerBrickAnimation1 * Math.PI * 2) * 0.1;
        const rotation_b = Math.cos(this.timerBrickAnimation1 * Math.PI * 2) * 0.1;
        const rotation_c = Math.sin(this.timerBrickAnimation1 * 2 * Math.PI * 2) * 0.1;
        const wobble_a = Math.sin(this.timerBrickAnimation2 * Math.PI * 2) * 3;
        const wobble_b = Math.cos(this.timerBrickAnimation2 * Math.PI * 2) * 4;

        this.shaderDiffuse.drawModel(
            this, this.fmBrick1,
            -5.0 * this.SCALE, 1.2 * this.SCALE, -1.0 * this.SCALE + wobble_a,
            rotation_a, rotation_b, rotation_c,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmBrick2,
            -4.4 * this.SCALE, -1.1 * this.SCALE, -0.4 * this.SCALE + wobble_b,
            rotation_c, rotation_b, rotation_a,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmBrick3,
            -2.8 * this.SCALE, -2.6 * this.SCALE, -1.6 * this.SCALE - wobble_a,
            rotation_c, -rotation_b, rotation_a,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmBrick4,
            0.3 * this.SCALE, -3.0 * this.SCALE, 0.0 * this.SCALE - wobble_b,
            -rotation_a, rotation_c, rotation_b,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmBrick3,
            1.2 * this.SCALE, 2.2 * this.SCALE, -1.6 * this.SCALE - wobble_a,
            rotation_a, rotation_c, rotation_b,
            this.SCALE * 0.9, this.SCALE * 0.9, this.SCALE * 0.9
        );

        // floating candles
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            -3.5 * this.SCALE, -2.9 * this.SCALE, 8.5 * this.SCALE - wobble_a,
            rotation_a, rotation_c, rotation_b,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            -3.3 * this.SCALE, -2.2 * this.SCALE, 9.5 * this.SCALE - wobble_b,
            rotation_c, rotation_b, rotation_a,
            this.SCALE * 0.8, this.SCALE * 0.8, this.SCALE * 0.8
        );
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            -1.8 * this.SCALE, -2.8 * this.SCALE, 10.2 * this.SCALE + wobble_a,
            -rotation_a, -rotation_b, rotation_c,
            this.SCALE, this.SCALE, this.SCALE
        );
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            -1.0 * this.SCALE, -4.2 * this.SCALE, 11.3 * this.SCALE + wobble_b,
            rotation_a, rotation_b, rotation_c,
            this.SCALE * 1.1, this.SCALE * 1.1, this.SCALE * 1.1
        );
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            1.1 * this.SCALE, -0.9 * this.SCALE, 8.7 * this.SCALE - wobble_a,
            -rotation_a, rotation_c, -rotation_b,
            this.SCALE * 0.9, this.SCALE * 0.9, this.SCALE * 0.9
        );
        this.shaderDiffuse.drawModel(
            this, this.fmCandle,
            -1.8 * this.SCALE, -1.1 * this.SCALE, 9.0 * this.SCALE - wobble_b,
            -rotation_b, rotation_c, rotation_a,
            this.SCALE * 0.9, this.SCALE * 0.9, this.SCALE * 0.9
        );

        this.setTexture2D(0, this.textureSky!, this.shaderDiffuse.sTexture!);
        this.shaderDiffuse.drawModel(
            this, this.fmSky,
            this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2],
            0, 0, Math.PI * -0.4,
            this.SCALE * 0.5, this.SCALE * 0.5, this.SCALE * 0.5
        );

        this.shaderDiffuseAnimatedTextureChunked.use();
        this.drawAnimated(this.timerCharactersAnimation, this.animationsSquirrel[this.animationPreset], this.fmSquirrel, this.textureSquirrel!, this.texturesSquirrelAnim[this.animationPreset]);
        this.drawAnimated(this.timerCharactersAnimation, this.animationsDryad[this.animationPreset], this.fmDryad, this.textureDryad!, this.texturesDryadAnim[this.animationPreset]);
        this.drawAnimated(this.timerCharactersAnimation, this.animationsBook[this.animationPreset], this.fmBook, this.textureStatic!, this.texturesBookAnim[this.animationPreset]);
        this.drawAnimated(this.timerPropsAnimation, this.animationProps, this.fmProps, this.textureStatic!, this.texturePropsAnim!);

        this.gl.enable(this.gl.BLEND);
        this.gl.depthMask(false);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

        this.shaderDiffuseAlpha.use();
        this.setTexture2D(0, this.textureFlameDiffuse!, this.shaderDiffuseAlpha.sTexture!);
        this.setTexture2D(1, this.textureFlameAlpha!, this.shaderDiffuseAlpha.sAlphaTexture!);

        for (let i = 0; i < this.STATIC_FLAMES.length; i++) {
            this.drawFlame(
                this.STATIC_FLAMES[i][0] * this.SCALE,
                this.STATIC_FLAMES[i][1] * this.SCALE,
                this.STATIC_FLAMES[i][2] * this.SCALE,
                i
            );
        }
        this.drawFlame(-3.5 * this.SCALE, -2.9 * this.SCALE, 8.5 * this.SCALE - wobble_a, 0.5);
        this.drawFlame(-1.8 * this.SCALE, -2.8 * this.SCALE, 10.2 * this.SCALE + wobble_a, 0.5);
        this.drawFlame(-1.8 * this.SCALE, -1.1 * this.SCALE, 9.0 * this.SCALE - wobble_b, 0.5);

        this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
        this.drawDust();

        this.gl.disable(this.gl.BLEND);
        this.gl.depthMask(true);
    }

    private drawDust(): void {
        if (this.shaderPointSpriteColored === undefined) {
            return;
        }

        const a = this.timerDustRotation * 360;
        const b = -this.timerDustRotation * 360;

        this.shaderPointSpriteColored.use();
        this.setTexture2D(0, this.textureDust!, this.shaderPointSpriteColored.tex0!);
        this.gl.uniform1f(this.shaderPointSpriteColored.uThickness!, this.dustSpriteSize);
        this.gl.uniform4f(this.shaderPointSpriteColored.color!, this.DUST_COLOR.r, this.DUST_COLOR.g, this.DUST_COLOR.b, this.DUST_COLOR.a);

        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            0, 0, 0,
            a, b, a,
            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE
        );
        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            0, 0, 0,
            b, -a, b,
            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE
        );
        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            0, 0, 70,
            -a, a, -b,
            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE
        );
        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            0, 0, 50,
            a, -b, b,
            this.DUST_SCALE, this.DUST_SCALE, this.DUST_SCALE
        );
        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            -5, 5, 70,
            -b, -b, a,
            this.DUST_SCALE / 5, this.DUST_SCALE / 5, this.DUST_SCALE / 5
        );
        this.drawPointSpritesVBOTranslatedRotatedScaled(
            this.shaderPointSpriteColored,
            this.fmDust,
            -5, 5, 0,
            -a, -b, -b,
            this.DUST_SCALE / 4, this.DUST_SCALE / 4, this.DUST_SCALE / 4
        );
    }

    private drawAnimated(timer: number, animation: TextureAnimationChunked, model: FullModel, textureDiffuse: WebGLTexture, textureAnimation: WebGLTexture) {
        this.gl.uniform1i(this.shaderDiffuseAnimatedTextureChunked!.uTextureWidthInt!, this.ANIMATION_TEXTURE_WIDTH);
        this.setTexture2D(0, textureDiffuse, this.shaderDiffuseAnimatedTextureChunked!.sTexture!);
        this.setTexture2D(1, textureAnimation, this.shaderDiffuseAnimatedTextureChunked!.sPositions!);
        this.gl.uniform4f(
            this.shaderDiffuseAnimatedTextureChunked!.uTexelSizes!,
            animation.textureWidth,
            animation.texelHalfWidth,
            animation.animateStartEndStart(timer),
            animation.chunkSize
        );
        this.gl.uniform1f(this.shaderDiffuseAnimatedTextureChunked!.uTexelHeight!, 1.0 / animation.textureHeight);
        this.shaderDiffuseAnimatedTextureChunked!.drawModel(
            this, model,
            0, 0, 0,
            0, 0, 0,
            this.SCALE, this.SCALE, this.SCALE
        );
    }

    private drawFlame(x: number, y: number, z: number, phase: number): void {
        const t = this.timerFlamesFlicker * Math.PI * 2 + phase;
        const scale = (2 + Math.sin(t) + Math.cos(t * 3.31)) / 4;

        this.shaderDiffuseAlpha!.drawModel(
            this,
            this.fmFlame,
            x, y, z,
            0, 0, this.getFlameAngle(x, y) + Math.PI / 2,
            4, 4, 4 + 1.8 * scale
        );
    }

    private getFlameAngle(x: number, y: number): number {
        const dx = this.cameraPosition[0] - x;
        const dy = this.cameraPosition[1] - y;
        const a = Math.atan2(dy, dx);
        return a;
    }

    private clamp(i: number, low: number, high: number): number {
        return Math.max(Math.min(i, high), low);
    }

    private randomizeCamera(): void {
        this.currentRandomCamera = (this.currentRandomCamera + 1 + Math.trunc(Math.random() * (this.CAMERAS.length - 2))) % this.CAMERAS.length;

        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED * this.CAMERAS[this.currentRandomCamera].speedMultiplier;
        this.cameraPositionInterpolator.position = this.CAMERAS[this.currentRandomCamera];
        this.cameraPositionInterpolator.reset();
    }

    private drawPointSpritesVBOTranslatedRotatedScaled(shader: PointSpriteColoredShader, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number) {
        model.bindBuffers(this.gl);

        this.gl.enableVertexAttribArray(shader.aPosition!);
        this.gl.vertexAttribPointer(shader.aPosition!, 3, this.gl.FLOAT, false, 4 * (3 + 2), 0);

        this.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

        this.gl.uniformMatrix4fv(shader.uMvp!, false, this.mMVPMatrix);
        this.gl.drawElements(this.gl.POINTS, model.getNumIndices() * 3, this.gl.UNSIGNED_SHORT, 0);
    }
}
