# Battle Worflow

## Select coins to battle
- Click 'Select coins' at the top

## Select one or more models to run
- For each models, it will run a battle. 
- The same coins are used at the start of each model battle
- The history battle for that model is added to an array containing the histories for all models for this battle.
- The battle history is saved to local storage every time it gets updated.

## Global winner
- A score is given to each coin based on the performance of the coin in each model battle. Every time a coin goes to the next round, it gets 1 point. If it wins the battle, it gets an extra 2 points. 

## View the results
- The results are displayed in a table
- The global winner is displayed with the score
- The winner of each model is displayed with the score
- The tournament winner is displayed with the score
- The tournament winner is the one with the highest score in the global winner column
