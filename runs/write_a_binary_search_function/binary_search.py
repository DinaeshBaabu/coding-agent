def binary_search(arr, target):
    """
    Performs binary search on a sorted array to find the target value.
    
    Args:
        arr: A sorted list of comparable elements
        target: The element to search for
        
    Returns:
        The index of the target if found, otherwise -1
        
    Raises:
        ValueError: If the array is not sorted
    """
    # Verify that the array is sorted
    for i in range(len(arr) - 1):
        if arr[i] > arr[i + 1]:
            raise ValueError("Array must be sorted")
    
    left = 0
    right = len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1


def binary_search_recursive(arr, target, left=0, right=None):
    """
    Performs binary search recursively on a sorted array.
    
    Args:
        arr: A sorted list of comparable elements
        target: The element to search for
        left: Left boundary index (default: 0)
        right: Right boundary index (default: len(arr) - 1)
        
    Returns:
        The index of the target if found, otherwise -1
        
    Raises:
        ValueError: If the array is not sorted
    """
    if right is None:
        right = len(arr) - 1
        # Verify that the array is sorted
        for i in range(len(arr) - 1):
            if arr[i] > arr[i + 1]:
                raise ValueError("Array must be sorted")
    
    if left > right:
        return -1
    
    mid = (left + right) // 2
    
    if arr[mid] == target:
        return mid
    elif arr[mid] < target:
        return binary_search_recursive(arr, target, mid + 1, right)
    else:
        return binary_search_recursive(arr, target, left, mid - 1)
