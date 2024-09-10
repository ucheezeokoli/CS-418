#include <iostream>
#include <fstream>
#include <vector>
#include <sstream>
#include <string>
#include "uselibpng.h"

using namespace std;

vector<string> split(const string& str, char delimiter) {
    vector<string> tokens;
    stringstream ss(str);
    string token;

    while (getline(ss, token, delimiter)) {
        tokens.push_back(token);
    }

    return tokens;
}

int main() {
    string warmup_messy1 = "./warmup-messy1.txt";

    fstream inputFile(warmup_messy1);

    string line;

    char delimiter = ' ';

    getline(inputFile,line);
    vector<string> line1 = split(line, delimiter);
    Image img = Image(stoi(line1.at(1)),stoi(line1.at(2)));
    cout << stoi(line1.at(1)) << stoi(line1.at(2)) << endl;

    while (getline(inputFile, line)) {
        vector<string> result = split(line, delimiter);
        if (result.at(0) == "png") {
            
        }
        cout << result.at(0) << endl;
    }

    return 0;
}

// #include "uselibpng.h"

// int main() {
//   /* ... */
//   Image img = Image(width, height);
//   /* ... */
//   img[y][x].red = /*...*/;
//   img[y][x].green = /*...*/;
//   img[y][x].blue = /*...*/;
//   img[y][x].alpha = /*...*/;
//   /* ... */
//   img.save(filename);
// }