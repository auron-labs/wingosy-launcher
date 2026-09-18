import type { GamesPage, ImmersiveGame } from "./immersive-types";

type RawImmersiveValue =
  | boolean
  | number
  | string
  | null
  | RawImmersiveValue[]
  | { [key: string]: RawImmersiveValue };

type ImmersiveGamePayload = Omit<
  ImmersiveGame,
  "genres" | "screenshot_paths"
> & {
  genres?: RawImmersiveValue;
  screenshot_paths?: RawImmersiveValue;
};

type ImmersiveGamesPagePayload = Omit<GamesPage, "games"> & {
  games: ImmersiveGamePayload[];
};

const isNonEmptyString = (value: RawImmersiveValue): value is string =>
  typeof value === "string" && value !== "";

const parseNonEmptyStringList = (value: RawImmersiveValue): string[] =>
  Array.isArray(value) ? value.filter(isNonEmptyString) : [];

/** Decode the string-list fields that come from an immersive game response. */
export const parseImmersiveGame = (
  game: ImmersiveGamePayload
): ImmersiveGame => ({
  ...game,
  genres: parseNonEmptyStringList(game.genres ?? null),
  screenshot_paths: parseNonEmptyStringList(game.screenshot_paths ?? null),
});

/** Decode every game in a page before it enters library state. */
export const parseImmersiveGamesPage = (
  page: ImmersiveGamesPagePayload
): GamesPage => ({
  ...page,
  games: page.games.map(parseImmersiveGame),
});
