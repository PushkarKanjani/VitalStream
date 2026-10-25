FROM flink:1.18.1-java11

# Python + PyFlink (apache-flink 1.18.1 supports Python 3.8-3.11)
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-dev && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --default-timeout=300 --retries 10 apache-flink==1.18.1 pymongo

# Kafka connector for the DataStream API (must match Flink 1.18)
RUN wget -q -O /opt/flink/lib/flink-sql-connector-kafka-3.1.0-1.18.jar \
    https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.1.0-1.18/flink-sql-connector-kafka-3.1.0-1.18.jar
