from PIL import Image

file_path = './warmup-simple.txt'

# Read the file line by line
with open(file_path, 'r') as file:
    lines = file.readlines()

fileLines = {}
for line in lines:
    line = line.split(" ")
    fileLines[line[0]] = line[1:]

# print(fileLines["png"])

image = Image.new("RGBA", (int(fileLines["png"][0]), int(fileLines["png"][1])))

posIdx = 0
colorIdx = 1
i = 0

while i < int(fileLines["png"][0]):
    x = int(fileLines["position"][posIdx])
    y = int(fileLines["position"][posIdx+1])
    r = int(fileLines["color"][colorIdx])
    g = int(fileLines["color"][colorIdx+1])
    b = int(fileLines["color"][colorIdx+2])
    a = int(fileLines["color"][colorIdx+3])

    image.im.putpixel((x,y), (r, g, b, a))

    i += 1
    posIdx += 2
    colorIdx += 4

image.save("aye.png")

# if fileLines[0][0] == "png":
#     height = fileLines[0][1]
#     width = fileLines[0][2]
#     image = Image.new("RGBA", (int(height), int(height)), (0,0,0,0))

# for line in fileLines:
#     if line[0][0] == ""

# print(content.split(" "))

# messyListRow = messy_warmup.split("\n")

# print("Messy list Rows => ",messyListRow)

# rowList = []

# for row in messyListRow:
#     rowList.append(row.split(" "))

# print("Rows List => ", rowList)
