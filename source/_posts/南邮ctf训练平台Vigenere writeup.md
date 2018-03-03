---
title: 南邮ctf训练平台Vigenere writeup
date: 2018-02-04 19:10:44
tags: 
    - ctf 
    - writeup
    - 密码学
categories: ctf
---
>原题链接：[http://ctf.nuptsast.com/challenges#Vigenere]()

## 题目分析
题目原文：
> It is said that Vigenere cipher does not achieve the perfect secrecy actually :-)
> Tips:
> 1.The encode pragram is given;
> 2.Do u no index of coincidence ？
> 3.The key is last 6 words of the plain text(with "nctf{}" when submitted, also without any interpunction)

加密代码：
```c
  #include <stdio.h>
  #define KEY_LENGTH 2 // Can be anything from 1 to 13
 
 main(){
   unsigned char ch;
   FILE *fpIn, *fpOut;
   int i;
   unsigned char key[KEY_LENGTH] = {0x00, 0x00};
   /* of course, I did not use the all-0s key to encrypt */
 
   fpIn = fopen("ptext.txt", "r");
   fpOut = fopen("ctext.txt", "w");
 
   i=0;
   while (fscanf(fpIn, "%c", &ch) != EOF) {
     /* avoid encrypting newline characters */  
     /* In a "real-world" implementation of the Vigenere cipher, 
        every ASCII character in the plaintext would be encrypted.
        However, I want to avoid encrypting newlines here because 
        it makes recovering the plaintext slightly more difficult... */
     /* ...and my goal is not to create "production-quality" code =) */
     if (ch!='\n') {
       fprintf(fpOut, "%02X", ch ^ key[i % KEY_LENGTH]); // ^ is logical XOR    
       i++;
       }
     }
  
   fclose(fpIn);
   fclose(fpOut);
   return;
 } 
```

密文：[http://ctf.nuptsast.com/static/uploads/9a27a6c8b9fb7b8d2a07ad94924c02e5/code.txt]()

---
可以看出，这道题的加密方式是维吉尼亚密码的变体。

原先的维吉尼亚加密，是指定一个密钥，然后将密钥循环与原文中每一个字母对应，这个字母偏移密钥在字母表中的序号后的新字母即为最终结果。如图：
![维吉尼亚加密](http://arian-blogs.oss-cn-beijing.aliyuncs.com/18-2-4/56426864.jpg)

而这道题是用1到14个长度范围内，未知的密钥，一一，并且循环与明文异或，跳过换行符，将每一位异或的结果输出为两位16位数作为密文。与传统维吉尼亚偏移的加密方式相比，使用了异或的形式来加密原文。

## 维吉尼亚密码回顾
要解这道题，先回顾传统维吉尼亚密码的解密形式。

我们知道，与凯撒密码不同之处在于，维吉尼亚密码中，一个字母可能生成几个不同的密文，因此，不能像凯撒密码那样用轮转密文的方法来破解维吉尼亚密码。要破解维吉尼亚密码，首先要理解到，虽然维吉尼亚密码打乱了字母与密文一一对应的关系，但同一位密钥所对应的不同密文，却有着相同的偏移量。也就是说，如果知道了密钥的长度，那每一位密钥所加密的那一组密文就像是凯撒密码那样有**相同的偏移量**。

所以如果能找出密钥的长度，那我们就能将密文分隔成几组由不同偏移量凯撒加密所形成的密文。

又有，在自然英语中，各个字母的**使用频率**不同，即一些字母使用频率高些，另一些字母使用频率低些。比如说，字母e的使用频率最高，约0.12，字母z的使用频率最低，为0.00074。据此，就可以分别统计出前述几组密文中各字母的出现频率，在对比自然英语字母的使用频率，然后就能猜测每一位密文所对应的原文。根据一组密文拥有相同的偏移量这一点，就可猜测出最终的密钥。

因而，解密维吉尼亚密码的第一步在于找出密钥的长度。只要找出了密钥的长度，就可以统计字频猜测具体密钥。

怎样才能求出密钥的长度？这里引入十分重要的一点，也是求解维吉尼亚密码的关键，即**重合指数**（index of coincidence）。重合指数是指，在一串字母中，任意取出两个字母，这两个字母相同的概率。例如，随机给出一串混乱的字母，它的重合指数总会在0.45附近，而一串有意义的英语段落，因为字母使用频率的影响，重合指数总是会在0.65附近，并且段落越长越接近这两个值。

易见的是，给一串字母相同的偏移量，并不会改变这串字母的重合指数。因此，通过同一位密钥加密而成的那一组维吉尼亚密文，因为它是有意义的段落，它的重合指数应该接近于自然英语的重合指数0.68。根据这一点，就可以猜测密钥的长度，再计算各个长度下密钥的重合指数（每个长度下的几组可以取均值），结果最接近0.68的那个结果，就可以大胆猜测是密钥的长度。

求出了密钥的长度，就可以如上述那样通过字频统计求出每一位密钥进而解密出原文了。

## 本题解法
知道了传统维吉尼亚密码的解法，再看本题，也就不难了。虽然本题最终采用了异或的方式来加密原文，而不是传统维吉尼亚密码的偏移，但最终，只要能够求出密钥的长度，都可以使用字频分析的方法来计算出密钥来解密。

所以说，求解本题，主要也是首先确定密钥长度。

这里第一个思路就可以像以上求传统维吉尼亚密码那样通过计算重合指数来确定。然而有一点不可忽视的是，重合指数法只适合于给出的密文全部由字母加密而成的情况。传统维吉尼亚密码只能加密字母（偏移），这道题则通过异或的方法来加密，使得任意字符都可以生成对应的密文。因此，由于其它非字母字符的干扰，就无法求出准确的重合指数，也就难以通过重合指数法寻找出密钥长度。

注意到，本题使用的是异或形式来加密。是否还记得异或有几个独特性质：
```
    a^a = 0         //一个数异或本身等于零
    a^0 = a         //一个数异或零等于本身
    (a^b)^c = a^(b^c)       //异或满足结合律
    a^b^b = a       //因此，一个数两次异或同一个数等于本身
```

本题的密文是由明文与密钥异或而来的，因此 `明文^密钥 = 密文`，也就是`明文 = 密文^密钥`。关键点是，**明文一定是由ascii字符组成的，并且密钥一定存在**。如果假定出密钥的长度，那么可以将密文划分成相应的几组，密钥的取值范围又在一定的范围之内（unsigned char ，0~255）。因此，如果在假定的长度下，某一组密文在这个范围内找不到合理的密钥（使得与密文异或为ascii字符的密钥），那就说明密钥不可能是这个长度。

通过这种方式，就可以求得密钥可能的长度范围的取值，并且还可以求出这个长度下，各组密文对应密钥的可能值（使得这组密文全部能求得ascii范围内的明文的所有可能取值）。

求出了密钥的长度，以及每一位密钥的可能取值，再测试出每一位密钥可能取值解出原文对应的字频，取其中最符合自然英语的那一个，就可以猜测这是最终的密钥了。

## 具体实现
首先，求出1~14范围内密钥的取值，如果有空集就证明不能为这个长度：
```python
def controlFlow():
    keyLengthRange = range(1,15)
    cipher = readCipher('c.txt')
    for i in keyLengthRange:
        keyGroup = getKeyRange(i, cipher)
        for a in keyGroup:
            if 0 == len(a):
                break;          #密钥每一位一定有值
        else:
            #没有空集就通过字频求具体值
            ......      #省略的代码
```

其中，getKeyRange求出每一位密钥的可能值：
```python
def getKeyRange(keyLength, cipher):
    '''
    测试每一位密钥可能的取值，若生成范围之外的明文，就抛弃这个值
    否则，就将这个值加入结果集之中
    '''
    cipherGroup = getCipherGroup(keyLength, cipher)
    keyGroup = [[] for a in range(keyLength)]

    count=0
    for perCipherGroup in cipherGroup:
        for keyTest in range(1,255):
            for perCipher in perCipherGroup:
                plainChar = perCipher^keyTest
                if plainChar not in range(32,127):
                    break
            else:
                keyGroup[count].append(keyTest)
        count+=1        #下一组密文

    return keyGroup
```

求出密钥范围，就通过字频统计求出具体值：
```python
def getLetterFrequency(key, perCipher):
'''
求出综合字频
'''
    frequencies = {"e": 0.12702, "t": 0.09056, "a": 0.08167, "o": 0.07507, "i": 0.06966,
                   "n": 0.06749, "s": 0.06327, "h": 0.06094, "r": 0.05987, "d": 0.04253,
                   "l": 0.04025, "c": 0.02782, "u": 0.02758, "m": 0.02406, "w": 0.02360,
                   "f": 0.02228, "g": 0.02015, "y": 0.01974, "p": 0.01929, "b": 0.01492,
                   "v": 0.00978, "k": 0.00772, "j": 0.00153, "x": 0.00150, "q": 0.00095,
                   "z": 0.00074}        #各个字母的出现频率

    count={}
    for ch in perCipher:
        plainChar = key^ch
        if plainChar in range(65,91) or plainChar in range(97,123):         #要排除非字母字符
            char = chr(plainChar).lower()
            count[char] = count.setdefault(char, 0)+1         #这个字母出现的次数

    freq = 0.0
    for a in count:
        freq += frequencies[a]*count[a]/len(perCipher)          #除以密文长度，以尽可能减小非字母字符对字频的影响

    return freq

def getKeyConfirmValue(keyGroup,cipher):
    '''
    计算假定某一位上的密钥是正确的情况下，用这个密钥解密密文所出来的明文段落中字母的综合使用频率，正确的密钥这个频率应该尽可能高
    '''
    cipherGroup = getCipherGroup(len(keyGroup), cipher)
    key = []

    count=0
    for perKey in keyGroup:
        maxFreq = 0
        tempKey = 0
        for a in perKey:
            freq = getLetterFrequency(a, cipherGroup[count])
            if freq>maxFreq:            #正确的密钥，算出来的综合字频应该尽可能大
                maxFreq = freq
                tempKey = a
        key.append(tempKey)
        count += 1
    
    return key
```

最后解密出原文：
```python
def cipherDecrypt(key, cipher):
    plainText = ''
    index = 0
    for a in cipher:
        plainText += chr(key[index%len(key)]^a)
        index += 1
    return plainText
```

最终得出的结果为：
> A possible key is: [186, 31, 145, 178, 83, 205, 62] 
> 
> A possible plainText is: Cryptography is the practice and study of techniques for, among other things, secure communication in the presence of attackers. Cryptography has been used for hundreds, if not thousands, of years, but traditional cryptosystems were designed and evaluated in a fairly ad hoc manner. For example, the Vigenere encryption scheme was thought to be secure for decades after it was invented, but we now know, and this exercise demonstrates, that it can be broken very easily. 

题目中说falg是原文最后六个字母，没有标点，因此最终得到的falg为：

> nctf{it can be broken very easily}          

对我一点也不简单就是了…

## 结语
觉得很有意义的一道题，通过这道题学习了许多知识点，所以写成了博客。希望文中不对的地方能够被大家指正:)。

---

*~~看了两篇writeup才能做出来什么的…。~~*

## 参考
[https://findneo.github.io/2017/10/nupt-vigenere/]()
[http://blog.csdn.net/qq_31344951/article/details/77934717]()
[https://zh.wikipedia.org/wiki/%E7%BB%B4%E5%90%89%E5%B0%BC%E4%BA%9A%E5%AF%86%E7%A0%81]()
[https://www.zhihu.com/question/29515338]()
[http://blog.csdn.net/limisky/article/details/16885959]()

<!--read more-->
## 完整代码
```python
def readCipher(filename):
    file = open(filename, 'r')
    strCipher = file.read()
    cipher = []
    index = 0
    while index < len(strCipher):
        cipher.append(int(strCipher[index:index+2], 16))
        index += 2
    return cipher

def getCipherGroup(keyLength, cipher):
    cipherGroup = [[] for a in range(keyLength)]
    count = 0
    while count < len(cipher):
        cipherGroup[(count) % keyLength] += [cipher[count]]
        count += 1
    return cipherGroup


def getKeyRange(keyLength, cipher):
    cipherGroup = getCipherGroup(keyLength, cipher)
    keyGroup = [[] for a in range(keyLength)]

    count=0
    for perCipherGroup in cipherGroup:
        for keyTest in range(1,255):
            for perCipher in perCipherGroup:
                plainChar = perCipher^keyTest
                if plainChar not in range(32,127):
                    break
            else:
                keyGroup[count].append(keyTest)
        count+=1

    return keyGroup

def getLetterFrequency(key, perCipher):
    frequencies = {"e": 0.12702, "t": 0.09056, "a": 0.08167, "o": 0.07507, "i": 0.06966,
                   "n": 0.06749, "s": 0.06327, "h": 0.06094, "r": 0.05987, "d": 0.04253,
                   "l": 0.04025, "c": 0.02782, "u": 0.02758, "m": 0.02406, "w": 0.02360,
                   "f": 0.02228, "g": 0.02015, "y": 0.01974, "p": 0.01929, "b": 0.01492,
                   "v": 0.00978, "k": 0.00772, "j": 0.00153, "x": 0.00150, "q": 0.00095,
                   "z": 0.00074}

    count={}
    for ch in perCipher:
        plainChar = key^ch
        if plainChar in range(65,91) or plainChar in range(97,123):
            char = chr(plainChar).lower()
            count[char] = count.setdefault(char, 0)+1

    freq = 0.0
    for a in count:
        freq += frequencies[a]*count[a]/len(perCipher)

    return freq

def getKeyConfirmValue(keyGroup,cipher):
    cipherGroup = getCipherGroup(len(keyGroup), cipher)
    key = []

    count=0
    for perKey in keyGroup:
        maxFreq = 0
        tempKey = 0
        for a in perKey:
            freq = getLetterFrequency(a, cipherGroup[count])
            if freq>maxFreq:
                maxFreq = freq
                tempKey = a
        key.append(tempKey)
        count += 1
    
    return key

def cipherDecrypt(key, cipher):
    plainText = ''
    index = 0
    for a in cipher:
        plainText += chr(key[index%len(key)]^a)
        index += 1
    return plainText

def controlFlow():
    keyLengthRange = range(1,15)
    cipher = readCipher('c.txt')
    for i in keyLengthRange:
        keyGroup = getKeyRange(i, cipher)
        for a in keyGroup:
            if 0 == len(a):
                break;          
        else:               
            #print('A possible key group is:', keyGroup,'\n')
            key = getKeyConfirmValue(keyGroup, cipher)
            print('A possible key is:', key,'\n')
            plainText = cipherDecrypt(key, cipher)
            print('A possible plainText is:', plainText,'\n')

if __name__=='__main__':
    controlFlow()

```
