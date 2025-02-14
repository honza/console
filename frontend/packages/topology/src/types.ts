import { ComponentType } from 'react';
import Point from './geom/Point';
import Rect from './geom/Rect';
import { Padding, Translatable } from './geom/types';

// x, y
export type PointTuple = [number, number];

export interface Layout {
  layout(): void;
  destroy(): void;
}

export type Model = {
  graph?: GraphModel;
  nodes?: NodeModel[];
  edges?: EdgeModel[];
};

export enum AnchorEnd {
  target,
  source,
  both,
}

export type GroupStyle = {
  padding?: Padding;
};

export enum NodeShape {
  circle,
  rect,
}

export enum ModelKind {
  graph = 'graph',
  node = 'node',
  edge = 'edge',
}

export interface ElementModel {
  id: string;
  type: string;
  label?: string;
  visible?: boolean;
  children?: string[];
  data?: any;
  style?: { [key: string]: any };
}

export interface NodeModel extends ElementModel {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  group?: boolean;
  shape?: NodeShape;
}

export interface EdgeModel extends ElementModel {
  source?: string;
  target?: string;
  bendpoints?: PointTuple[];
}

export interface GraphModel extends ElementModel {
  layout?: string;
  x?: number;
  y?: number;
  scale?: number;
}

export interface Anchor<E extends Node = Node> {
  getLocation(reference: Point): Point;
  getReferencePoint(): Point;
}

export interface GraphElement<E extends ElementModel = ElementModel, D = any> extends WithState {
  getKind(): ModelKind;
  getLabel(): string;
  setLabel(label: string): void;
  getOrderKey(): number[];
  isDetached(): boolean;
  getController(): Controller;
  setController(controller?: Controller): void;
  getGraph(): Graph;
  getParent(): GraphElement;
  hasParent(): boolean;
  setParent(parent: GraphElement | undefined): void;
  getId(): string;
  setId(id: string): void;
  getType(): string;
  setType(type: string): void;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  getData(): D | undefined;
  setData(data: D | undefined): void;
  getChildren(): GraphElement[];
  insertChild(child: GraphElement, index: number): void;
  appendChild(child: GraphElement): void;
  removeChild(child: GraphElement): void;
  remove(): void;
  setModel(model: E): void;
  raise(): void;
  getStyle<T extends {}>(): T;
  translateToAbsolute(t: Translatable): void;
  translateFromAbsolute(t: Translatable): void;
  translateToParent(t: Translatable): void;
  translateFromParent(t: Translatable): void;
}

export interface Node<E extends NodeModel = NodeModel, D = any> extends GraphElement<E, D> {
  getAnchor(end: AnchorEnd, type?: string): Anchor;
  setAnchor(anchor: Anchor, end?: AnchorEnd, type?: string): void;
  getNodes(): Node[];
  // TODO return an immutable rect
  getBounds(): Rect;
  setBounds(bounds: Rect): void;
  isGroup(): boolean;
  getNodeShape(): NodeShape;
  setNodeShape(shape: NodeShape): void;
  getSourceEdges(): Edge[];
  getTargetEdges(): Edge[];
}

export interface Edge<E extends EdgeModel = EdgeModel, D = any> extends GraphElement<E, D> {
  getSource(): Node;
  setSource(source: Node): void;
  getTarget(): Node;
  setTarget(target: Node): void;
  getStartPoint(): Point;
  setStartPoint(x?: number, y?: number): void;
  getEndPoint(): Point;
  setEndPoint(x?: number, y?: number): void;
  getBendpoints(): Point[];
  setBendpoints(points: Point[]): void;
  removeBendpoint(point: Point | number): void;
}

export interface Graph<E extends GraphModel = GraphModel, D = any> extends GraphElement<E, D> {
  getNodes(): Node[];
  getEdges(): Edge[];
  getBounds(): Rect;
  setBounds(bounds: Rect): void;
  getScale(): number;
  setScale(scale: number): void;
  getLayout(): string | undefined;
  setLayout(type: string | undefined): void;
  layout(): void;

  // viewport operations
  reset(): void;
  scaleBy(scale: number, location?: Point): void;
  fit(padding?: number): void;
  panIntoView(element: Node, options: { offset?: number; minimumVisible?: number }): void;
}

export const isGraph = (element: GraphElement): element is Graph => {
  return element && element.getKind() === 'graph';
};

export const isNode = (element: GraphElement): element is Node => {
  return element && element.getKind() === 'node';
};

export const isEdge = (element: GraphElement): element is Edge => {
  return element && element.getKind() === 'edge';
};

export type EventListener<Args extends any[] = any[]> = (...args: Args) => void;

export type State = { [key: string]: any };

export interface WithState {
  getState<S extends {} = {}>(): S;
  setState(state: State): void;
}

export type LayoutFactory = (type: string, graph: Graph) => Layout | undefined;

export type ComponentFactory = (
  kind: ModelKind,
  type: string,
) => ComponentType<{ element: GraphElement }> | undefined;

export type ElementFactory = (kind: ModelKind, type: string) => GraphElement | undefined;

export interface Controller extends WithState {
  getStore<S extends {} = {}>(): S;
  fromModel(model: Model): void;
  getGraph(): Graph;
  setGraph(graph: Graph): void;
  getLayout(type: string | undefined): Layout | undefined;
  getElementById(id: string): GraphElement | undefined;
  getNodeById(id: string): Node | undefined;
  getEdgeById(id: string): Edge | undefined;
  addElement(element: GraphElement): void;
  removeElement(element: GraphElement): void;
  getComponent(kind: ModelKind, type: string): ComponentType<{ element: GraphElement }>;
  registerLayoutFactory(factory: LayoutFactory): void;
  registerComponentFactory(factory: ComponentFactory): void;
  registerElementFactory(factory: ElementFactory): void;
  addEventListener<L extends EventListener = EventListener>(type: string, listener: L): Controller;
  removeEventListener(type: string, listener: EventListener): Controller;
  fireEvent(type: string, ...args: any): void;
  getElements(): GraphElement[];
}
