docker run --rm -p 9200:9200 -e "http.host=0.0.0.0" -e "transport.host=127.0.0.1" -v esdata:/usr/share/elasticsearch/data docker.elastic.co/elasticsearch/elasticsearch:5.5.1
