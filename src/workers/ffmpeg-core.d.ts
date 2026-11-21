declare module "@ffmpeg/core" {
  interface FFmpegCore {
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array<ArrayBufferLike>;
    };
    exec(...args: string[]): number;
  }

  export default function createFFmpegCore(options: {
    mainScriptUrlOrBlob: string;
  }): Promise<FFmpegCore>;
}
