export interface VideoItem {
  id: number;
  uuid: string;
  video: string;
  duration: string;
  width: number;
  height: number;
  size: number;
  codec: string;
  codecLong: string;
  authorHistory: string[];
  name: string;
  category: string;
  muscles: string[];
  image: string | null;
}
