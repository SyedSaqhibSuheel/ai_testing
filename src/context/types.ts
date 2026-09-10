export interface EndpointInfo {
  httpMethod: string;
  path: string;
  pathVars: string[];
  requestBodyType?: string;
  summary?: string;
}

export interface ControllerInfo {
  file: string;
  className: string;
  basePaths: string[];
  endpoints: EndpointInfo[];
}

export interface DtoField {
  name: string;
  type: string;
}

export interface DtoInfo {
  file: string;
  className: string;
  fields: DtoField[];
}

export interface RouteInfo {
  file: string;
  path: string;
  component?: string;
}

export interface ComponentTestIds {
  file: string;
  componentName?: string;
  testIds: string[];
}

export interface BackendContext {
  controllers: ControllerInfo[];
  dtos: DtoInfo[];
}

export interface FrontendContext {
  routes: RouteInfo[];
  components: ComponentTestIds[];
}

export interface AppContext {
  builtAt: string;
  backend: BackendContext;
  frontend: FrontendContext;
  sourceHash: string;
}
