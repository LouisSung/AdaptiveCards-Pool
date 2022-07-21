/**
 * @file [Library] Provide a card pool for AdaptiveCards to cache recent cards and prevent frequently re-rendering
 * @author Louis Sung <me@louissung.com> All Lefts Reserved
 * @version v0.1.0
 * @licence MIT
 */
import { AdaptiveCard, CardElement, Input } from 'adaptivecards';
import 'jsdom-global/register';


const DEBUG_MODE = true; // disable console.debug() as needed
console.debug = DEBUG_MODE ? console.debug : () => void 0;
// <script src="https://unpkg.com/adaptivecards@2.10.0/dist/adaptivecards.js"></script>
// const { AdaptiveCard } = AdaptiveCards;
const cardPlaceholder = document.createElement('div');
document.body.appendChild(cardPlaceholder);

type CardName = string;
type CardPayload = Record<string, unknown>;
class CardPool {
  private readonly CAPACITY_CARDS: number;
  private readonly CAPACITY_STATEFUL_CARDS: number;

  private readonly cardPool: Record<CardName, AdaptiveCard> = {};
  private readonly cardSet = new Set<CardName>();
  private readonly statefulCardSet = new Set<CardName>();

  constructor(cardPoolCapacity = 8) {
    this.CAPACITY_CARDS = Math.max(4, cardPoolCapacity); // keep at least 4 cards in pool
    this.CAPACITY_STATEFUL_CARDS = Math.ceil(this.CAPACITY_CARDS / 4); // reserve 25% capacity (at least 1) for stateful cards
  }

  public getCard(cardName: CardName, cardPayload?: CardPayload): AdaptiveCard | undefined {
    if (this.cardPool[cardName] !== undefined) {
      console.debug(`Hit cached card: ${cardName}`);
    } else if (cardPayload !== undefined) {
      this.cardPool[cardName] = CardPool.createCardOnDemand(cardName, cardPayload);
    }
    this.markCardInuse(cardName);
    return this.cardPool[cardName];
  }

  public markCardInuse(cardName: CardName, statefulCard?: AdaptiveCard): void {
    if (this.cardPool[cardName] !== undefined || statefulCard) { // card found in pool or provided if purged
      this.cardSet.delete(cardName); // delete anyway, no matter exists or not
      this.cardSet.add(cardName); // move the card to the END to mark as MRU (most recently used), as the set in JS is ordered
      // deal with stateful cards with inputs (onInputValueChanged) or conditional visibilities (onElementVisibilityChanged)
      if (statefulCard instanceof AdaptiveCard) { // mark on demand if provided in callbacks (onCardChanged)
        this.statefulCardSet.delete(cardName);
        this.statefulCardSet.add(cardName);
        this.cardPool[cardName] ??= statefulCard; // add card back if purged
      }
      this.purgeUnusedCard();
    }
  }

  private static createCardOnDemand(cardName: CardName, cardPayload: CardPayload): AdaptiveCard {
    const card = new AdaptiveCard();
    card.parse(cardPayload);
    card.setCustomProperty('cardName', cardName); // bind cardName to AdaptiveCard instance for later lookup if purged for pool
    console.debug(`Added card: ${ cardName }`);
    return card;
  }

  private purgeUnusedCard(): void {
    if(this.statefulCardSet.size > this.CAPACITY_STATEFUL_CARDS) {
      const cardName = Array.from(this.statefulCardSet)[0] // use Array.from() instead of keys().next().value for better performance
      this.statefulCardSet.delete(cardName); // dequeue the LRU card (i.e., mark as REMOVABLE for the later check)
      console.debug(`Dequeued LRU stateful card: ${ cardName }`, this.statefulCardSet);
    }
    if(this.cardSet.size > this.CAPACITY_CARDS) {
      for(const cardName of Array.from(this.cardSet)) { // forced use Array.from() here to prevent broken set iteration after transpile
        if(!this.statefulCardSet.has(cardName)) { // the LRU card might have been dequeued in the statefulCardSet (i.e., REMOVABLE)
          this.cardSet.delete(cardName);
          delete this.cardPool[cardName];
          console.debug(`Purged LRU NON-stateful card: ${ cardName }`, this.cardSet);
          break;
        }
      }
    }
  }
}

(function main() {
  const cardPool = new CardPool();
  const cardNames = Array.from(Array(4).keys()).reverse().concat(Array.from(Array(16).keys())).map((i) => i.toString()); // i.e., [3~0, 0~15]

  AdaptiveCard.onInputValueChanged = function(input: Input): void {
    const statefulCard = input.getRootObject() as AdaptiveCard;
    cardPool.markCardInuse(statefulCard.getCustomProperty('cardName'), statefulCard);
    console.debug('InputValueChanged:', cardPool['statefulCardSet'], cardPool['cardSet'], cardPool['cardPool'], input);
  }

  AdaptiveCard.onElementVisibilityChanged = function(element: CardElement): void {
    const statefulCard = element.getRootObject() as AdaptiveCard;
    cardPool.markCardInuse(statefulCard.getCustomProperty('cardName'), statefulCard);
    console.debug('ElementVisibilityChanged:', cardPool['statefulCardSet'], cardPool['cardSet'], cardPool['cardPool'], element);
  }

  for(const cardName of cardNames) {
    const card = cardPool.getCard(cardName, {
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      body: [
        { type: 'Input.Text', placeholder: `Card ${ cardName }`, id: 'anInput' },
        { type: 'ActionSet', actions: [{ type: 'Action.ToggleVisibility', title: `Toggle ${ cardName }`, targetElements: ['anInput'] }]}
      ]
    });
    card?.render(cardPlaceholder);
    console.debug(`Rendered card: ${ cardName }`);
  }
})();
