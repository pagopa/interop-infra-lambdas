FROM public.ecr.aws/lambda/nodejs:20@sha256:396710b85c6d5a4c94c6f2d3a1f48b25228b0d6758a505a78a2e832f9d5df948

RUN dnf upgrade -y
RUN dnf -y update && dnf -y install unzip groff less vi sudo tar make openssl && dnf clean all 

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
ENV EASYRSA_BIN_PATH="/opt/easyrsa"
ENV PATH="$EASYRSA_BIN_PATH:$PATH"
ENV LD_LIBRARY_PATH=""

CMD ["index.handler"]