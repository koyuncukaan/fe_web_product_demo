#!/bin/bash
set -ex

source .env
RUNNING_MODE=$1
TMP_DIR="$(mount | grep tmp | awk '{print $1}')"
# TMP_DIR="/tmp"
PRJNAME=$(basename "$PWD")

ENV_FILE="sample.env"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git describe --always)
TAG="${BRANCH}_${COMMIT}"
BASE_NAME="${PRJNAME}_${BRANCH}"
CONTAINER_NAME="local_${BASE_NAME}"
PROXY_NAME="proxy_${BASE_NAME}"
TAGGED_IMAGE=$(echo "${PRJNAME}_${TAG}" | tr '[:upper:]' '[:lower:]')

# Custom mockoon locations
locations=("test")

run_nginx() {
	cat <<EOF >"${TMP_DIR}/fe.conf"
server {
    listen       2000;
    server_name  localhost;
EOF
	curl -sSL https://www.akakce.dev/nginx-conf/ | awk '/location/ {print}' | grep -v 'location / ' >>"${TMP_DIR}/fe.conf"

	for l in "${locations[@]}"; do
		echo "    location /${l} { proxy_pass http://${1}:5000; }" >>"${TMP_DIR}/fe.conf"
	done
	cat <<EOF >>"${TMP_DIR}/fe.conf"
    location /                               { proxy_pass http://192.168.1.100; }
}
EOF
	sed -i "s|127\.0\.0\.1|${1}|g" "${TMP_DIR}/fe.conf"

	# Change location for mockoon
	# local paths=("j/llc/lv")
	# for p in "${paths[@]}"; do
	#     sed -e "s|\(${p}\).*|\1 \{ proxy_pass http://127.0.0.1:5000; \}|" -i $TMP_DIR/fe.conf
	# done

	docker run -p 2000:2000 --name "${PROXY_NAME}" \
		-v "${TMP_DIR}/fe.conf:/etc/nginx/conf.d/fe.conf:ro" \
		--restart unless-stopped -d nginx:stable-alpine
}

run_app() {
	export SELF__RUNNING_ENV
	case $RUNNING_MODE in
	dev)
		pnpm pre-build
		pnpm dev
		;;
	docker)
		docker build . --tag "${TAGGED_IMAGE}" --build-arg SELF__RUNNING_ENV="${SELF__RUNNING_ENV}"
		docker rm -f "${CONTAINER_NAME}" || true
		docker run --env-file "${TMP_DIR}/${ENV_FILE}" -p 3000:3000 --name "${CONTAINER_NAME}" "${TAGGED_IMAGE}"
		;;
	*)
		exit
		;;
	esac
}

# Clean up and remove existing proxy and app containers
docker rm -f "${PROXY_NAME}" "${CONTAINER_NAME}" || true

# Remove double quotes and spaces around equal signs in the environment file
sed -e 's/"//g' -e 's/ =/=/g' -e 's/= /=/g' "${ENV_FILE}" >"${TMP_DIR}/${ENV_FILE}"
app_uri=$(ipconfig | grep IPv4 | grep 192 | head -n 1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+')
run_nginx "${app_uri}"
run_app

