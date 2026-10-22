#!/usr/bin/env bash
# Run on a computer with AWS CLI access to the user's intended AWS account.
set -euo pipefail
REGION=us-east-1
STACK=noethara-mobile-ec2
KEY_NAME=noethara-mobile-ssh
KEY_FILE="${HOME}/.ssh/${KEY_NAME}.pem"
: "${NOETHARA_VPC_ID:?Export the VPC ID before running}"
: "${NOETHARA_SUBNET_ID:?Export a public subnet ID before running}"
: "${NOETHARA_ADMIN_CIDR:?Export your public IPv4 address/32, e.g. 203.0.113.20/32}"
if [[ "${NOETHARA_ADMIN_CIDR}" == "0.0.0.0/0" ]]; then
  echo 'Refusing to open SSH and API debugging to the entire internet' >&2; exit 1
fi
command -v aws >/dev/null || { echo 'AWS CLI not installed' >&2; exit 1; }
ACCOUNT=$(aws sts get-caller-identity --region "$REGION" --query Account --output text)
if [[ "$ACCOUNT" != "234983729833" ]]; then
  echo "Wrong AWS account configured: $ACCOUNT. Refusing to deploy." >&2; exit 1
fi
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
if [[ ! -e "$KEY_FILE" ]]; then
  if aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEY_NAME" >/dev/null 2>&1; then
    echo "Key pair already exists in AWS but private key is absent locally. Choose a new key name or recover your securely stored key." >&2
    exit 1
  fi
  umask 077
  aws ec2 create-key-pair --region "$REGION" --key-name "$KEY_NAME" --key-type ed25519 --key-format pem \
    --query 'KeyMaterial' --output text > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "Private SSH key created at $KEY_FILE (never upload this file to GitHub or chat)"
fi
aws cloudformation deploy --region "$REGION" \
  --stack-name "$STACK" \
  --template-file infra/aws/noethara-ec2.yml \
  --parameter-overrides \
    KeyPairName="$KEY_NAME" VpcId="$NOETHARA_VPC_ID" \
    SubnetId="$NOETHARA_SUBNET_ID" AdminCidr="$NOETHARA_ADMIN_CIDR" \
  --no-fail-on-empty-changeset
echo 'EC2 stack outputs:'
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
echo "Private SSH key location: $KEY_FILE"
