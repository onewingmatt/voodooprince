// Mirrors server/protocol.js — kept in sync by hand (no shared package needed for this size of app).

export const ClientAction = {
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  ADD_BOT: 'ADD_BOT',
  REMOVE_SEAT: 'REMOVE_SEAT',
  SET_RULESET: 'SET_RULESET',
  START_GAME: 'START_GAME',
  CHOOSE_TRUMP: 'CHOOSE_TRUMP',
  PLAY_CARD: 'PLAY_CARD',
};

export const ServerEvent = {
  ROOM_STATE: 'ROOM_STATE',
  GAME_STATE: 'GAME_STATE',
  ERROR: 'ERROR',
  LOG: 'LOG',
};
