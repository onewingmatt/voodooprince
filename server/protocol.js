// Shared message shape between server and client (duplicated in client/src/net/protocol.js).

export const ClientAction = {
  CREATE_ROOM: 'CREATE_ROOM',
  JOIN_ROOM: 'JOIN_ROOM',
  REJOIN_ROOM: 'REJOIN_ROOM',
  ADD_BOT: 'ADD_BOT',
  REMOVE_SEAT: 'REMOVE_SEAT',
  SET_RULESET: 'SET_RULESET',
  START_GAME: 'START_GAME',
  CHOOSE_TRUMP: 'CHOOSE_TRUMP',
  PLAY_CARD: 'PLAY_CARD',
};

export const ServerEvent = {
  SESSION: 'SESSION',
  ROOM_STATE: 'ROOM_STATE',
  GAME_STATE: 'GAME_STATE',
  ERROR: 'ERROR',
  LOG: 'LOG',
};
