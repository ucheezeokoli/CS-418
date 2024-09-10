.PHONEY: build, run

build: program

run: program
	./create_pixels $(file)

program: main.cpp
	clang++ -O3 -I. main.cpp uselibpng.c -lpng -o program