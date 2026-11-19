def solution(nums):
    best = nums[0]
    for n in nums[1:]:
        if n > best:
            best = n
    return best
