# A basic bot for yare.io

A simple helper library for yare.io including a sample bot utilizing it.
This bot is currently fairly dumb, only implementing basic charging/defending and attacking with minimal tactics.

See [yare.io](yare.io) for details on the game.

![Screenshot of yare.io](https://user-images.githubusercontent.com/887397/120892614-269fa700-c607-11eb-9308-907374787249.png)

### Notes:
- `run` & `init` functions are implemented outside of the Entity object in order to allow these to be updated at run time. The Entities themselves persist within the memory object.

### Change log
* Add pest control (detect if anyone's lurking near base to keep it offline) & target them with soldiers
* Move some config vars to top so can switch live (Mostly to enable earlier attack on inactive opponents)
* Add scout mode - nominating a drone to sit near the enemy base and lock it down.

