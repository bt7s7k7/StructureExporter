#!/bin/env bash
target_dir="release.local"
repository_url="git@github.com:bt7s7k7/StructureExporter.git"

if [ ! -d "$target_dir" ]; then
    git clone -b docs "$repository_url" "$target_dir"
else
    echo "Directory '$target_dir' already exists. Skipping clone."
fi

cd "$target_dir"
git pull
cd -

mv "$target_dir/.git" .tmp_git
rm -rf "$target_dir"
mkdir "$target_dir"
mv .tmp_git "$target_dir/.git"
cp -r dist/* "$target_dir"

cd "$target_dir"
git add .
git commit --amend --no-edit
git push --force
cd -
