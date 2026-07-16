export interface TurnState {
  playerIds: string[];
  currentTurnId: string;
  direction: number;
  step?: number;
}

export function getNextTurnId({
  playerIds,
  currentTurnId,
  direction,
  step = 1,
}: TurnState): string {
  if (playerIds.length === 0) return '';

  let currentIndex = playerIds.indexOf(currentTurnId);
  if (currentIndex === -1) currentIndex = 0;

  for (let index = 0; index < step; index++) {
    currentIndex =
      (currentIndex + direction + playerIds.length) % playerIds.length;
  }

  return playerIds[currentIndex];
}

export function buildTurnPriorityMap(
  playerIds: string[],
  currentTurnId: string,
): Record<string, number> {
  const priorities: Record<string, number> = {};
  if (playerIds.length === 0) return priorities;

  let currentIndex = playerIds.indexOf(currentTurnId);
  if (currentIndex === -1) currentIndex = 0;

  for (let index = 0; index < playerIds.length; index++) {
    priorities[playerIds[(currentIndex + index) % playerIds.length]] = index;
  }
  return priorities;
}

export interface RankingPlayer {
  sessionId: string;
  bankrupt: boolean;
  handCount: number;
}

export function rankPlayers(
  players: RankingPlayer[],
  winnerSessionId: string,
  turnPriority: Record<string, number>,
): string[] {
  return [...players]
    .sort((first, second) => {
      if (first.sessionId === winnerSessionId) return -1;
      if (second.sessionId === winnerSessionId) return 1;
      if (first.bankrupt && !second.bankrupt) return 1;
      if (!first.bankrupt && second.bankrupt) return -1;
      if (first.handCount !== second.handCount) {
        return first.handCount - second.handCount;
      }
      return (
        (turnPriority[first.sessionId] ?? 999) -
        (turnPriority[second.sessionId] ?? 999)
      );
    })
    .map((player) => player.sessionId);
}

export interface DealtOneCardGame<T> {
  hands: Map<string, T[]>;
  firstCard: T | null;
  deck: T[];
}

export function dealOneCardGame<T extends { type: string }>(
  cards: T[],
  playerIds: string[],
  handSize = 7,
  reshuffle: (cards: T[]) => T[] = (values) => [...values],
): DealtOneCardGame<T> {
  const deck = [...cards];
  const hands = new Map<string, T[]>();

  playerIds.forEach((playerId) => {
    const hand: T[] = [];
    for (let index = 0; index < handSize; index++) {
      const card = deck.shift();
      if (card) hand.push(card);
    }
    hands.set(playerId, hand);
  });

  let firstCard = deck.shift() ?? null;
  if (firstCard?.type === 'ikart' && deck.length > 0) {
    deck.push(firstCard);
    const shuffled = reshuffle(deck);
    deck.length = 0;
    deck.push(...shuffled);

    const firstPlayableCardIndex = deck.findIndex(
      (card) => card.type !== 'ikart',
    );
    firstCard =
      firstPlayableCardIndex >= 0
        ? (deck.splice(firstPlayableCardIndex, 1)[0] ?? null)
        : (deck.shift() ?? null);
  }

  return { hands, firstCard, deck };
}
