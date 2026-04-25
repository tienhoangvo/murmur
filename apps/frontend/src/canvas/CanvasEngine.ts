import { Viewport } from "./Viewport";
import { Renderer } from "./Renderer";
import { HitTester } from "./HitTester";
import { InputHandler } from "./InputHandler";
import { SelectionManager } from "./SelectionManager";
import { getBoardState } from "../store/boardStore";

export class CanvasEngine {
  private viewport: Viewport;
  private renderer: Renderer;
  private hitTester: HitTester;
  private inputHandler: InputHandler;
  private selectionManager: SelectionManager;

  private rafId: number | null = null;
  private isDirty = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement,
  ) {
    const ctx = canvas.getContext("2d")!;
    this.setupDpr(canvas);
    this.setupDpr(overlayCanvas);

    this.viewport = new Viewport(canvas);
    this.renderer = new Renderer(ctx, this.viewport);
    this.hitTester = new HitTester();
    this.inputHandler = new InputHandler(
      canvas,
      this.viewport,
      this.hitTester,
      () => this.markDirty(),
    );
    this.selectionManager = new SelectionManager();

    // keyboard shortcuts
    window.addEventListener("keydown", this.onKeyDown);

    this.startLoop();
  }

  private setupDpr(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
  }

  private startLoop() {
    const loop = () => {
      if (this.isDirty) {
        this.draw();
        this.isDirty = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private draw() {
    const { elements, zOrder } = getBoardState();
    this.renderer.render(Object.values(elements), zOrder);
  }

  markDirty() {
    this.isDirty = true;
  }

  resize() {
    this.setupDpr(this.canvas);
    this.setupDpr(this.overlayCanvas);
    this.markDirty();
  }

  getSelectionManager() {
    return this.selectionManager;
  }

  getViewport() {
    return this.viewport;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.selectionManager.handleKeyDown(e);
    this.markDirty();
  };

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.inputHandler.destroy();
    window.removeEventListener("keydown", this.onKeyDown);
  }
}
