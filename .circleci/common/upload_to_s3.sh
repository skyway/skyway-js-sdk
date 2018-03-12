#!/usr/bin/env bash
# use source upload_to_s3.sh to import this function

####
# Description: Upload a file to an s3 bucket
# Usage: upload_to_s3 PATH_TO_FILE S3_BUCKET [S3_FILENAME]
# Arguments:
#   PATH_TO_FILE: Relative or absolute path to the file to upload. e.g. "./dist/skyway.js"
#   S3_BUCKET: The name of the bucket. e.g. "s3://eclrtc-cdn-staging/"
#   S3_FILENAME: What to name the file when it is put in the bucket. e.g. "skyway-latest.js"
####
function upload_to_s3() {
    if [[ -z "$1" || -z "$2" ]]
    then
        echo "${FUNCNAME[0]} requires at least 2 arguments";
        return 1;
    fi

    path_to_file=$1;
    s3_bucket=$2;
    s3_filename=$3;

    s3cmd --no-mime-magic --guess-mime-type put "$path_to_file" "$s3_bucket$s3_filename";
    return $?;
}

####
# Description: Upload a directory to an s3 bucket
# Usage: upload_to_s3 PATH_TO_DIRECTORY S3_BUCKET
# Arguments:
#   PATH_TO_DIRECTORY: Relative or absolute path to the directory to upload. e.g. "./examples"
#                      Make sure to use quotes if it contains a wildcard character. e.g. upload_to_s3 "./examples/*" s3://bucket_name
#   S3_BUCKET: The name of the bucket. e.g. "s3://eclrtc-cdn-staging/"
####
function upload_dir_to_s3() {
    if [[ -z "$1" || -z "$2" ]]
    then
        echo "${FUNCNAME[0]} requires at least 2 arguments";
        return 1;
    fi

    path_to_directory=$1;
    s3_bucket=$2;

    s3cmd --no-mime-magic --guess-mime-type put -r $path_to_directory "$s3_bucket";
    return $?;
}
