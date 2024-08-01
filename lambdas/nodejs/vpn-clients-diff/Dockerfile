FROM public.ecr.aws/lambda/nodejs:20

RUN dnf -y update && dnf -y install unzip groff less vi sudo tar make openssl

# Install EasyRSA
RUN curl -L https://github.com/OpenVPN/easy-rsa/releases/download/v3.1.7/EasyRSA-3.1.7.tgz -o easyrsa-3.1.7.tar.gz && \
tar xzf easyrsa-3.1.7.tar.gz && \
rm easyrsa-3.1.7.tar.gz && \
mv EasyRSA-3.1.7 /opt/easyrsa

RUN mkdir -p ${LAMBDA_TASK_ROOT}/scripts
RUN mkdir -p ${LAMBDA_TASK_ROOT}/lib
# Copy custom script
COPY scripts/ ${LAMBDA_TASK_ROOT}/scripts/
COPY lib/ ${LAMBDA_TASK_ROOT}/lib/
COPY *.js ${LAMBDA_TASK_ROOT}
COPY package*.json ${LAMBDA_TASK_ROOT}


# Install any needed packages specified in package.json
WORKDIR ${LAMBDA_TASK_ROOT}
RUN npm install

# Set environment variables
ENV EASYRSA_PATH="/opt/easyrsa"
ENV PATH="$EASYRSA_PATH:$PATH"
ENV LD_LIBRARY_PATH=""

CMD ["index.handler"]