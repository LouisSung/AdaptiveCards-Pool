# Adaptive Cards Pool | A Pool of Card Caches
## What
To show an example on how to implement a lookup pool of caches to prevent frequently re-rendering

## How
1. Use two sets (as queues of unique elements) to record the MRU (most recently used) time of normal cards and stateful cards
    + Where the stateful cards is defined as those uses `Input.*` (detect with `onInputValueChanged`) or `Action.ToggleVisibility` (detect with `onElementVisibilityChanged`)
2. Use one object (cardPool) to store all the AdaptiveCards instances, and purge as needed
