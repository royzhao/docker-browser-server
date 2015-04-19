from dockerfile/nodejs

COPY . /src
RUN cd /src; npm install

EXPOSE 8080

ENTRYPOINT ["nodejs","/src/bin.js"]