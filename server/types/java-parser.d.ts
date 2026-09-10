declare module 'java-parser' {
  export function parse(source: string): any;
  export function parseString(source: string): any;
  export function parseFile(filePath: string): any;
  export interface Parser {
    parse(source: string): any;
  }
}
